import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { fetch as expoFetch } from 'expo/fetch';
import OpenAI from 'openai/index';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { loadChatMessages, saveChatMessages } from '../storage/chatDb';
import type { AgentConfig, ChatAttachment, ChatMessage, ReasoningEffort } from '../types';

type UseRelayChatOptions = {
  assistantName?: string;
  config: AgentConfig;
  initialMessages?: ChatMessage[];
  sessionId: string;
  systemPrompt?: string;
};

export type PendingImageAttachment = {
  id: string;
  type: 'image';
  source: 'local';
  localUri: string;
  mimeType?: string;
  fileName?: string;
  base64: string;
};

export type PendingRemoteAttachment = {
  id: string;
  type: 'image';
  source: 'remote';
  uri: string;
  relayUrl?: string;
  localUri?: string;
  mimeType?: string;
  fileName?: string;
};

export type PendingAttachment = PendingImageAttachment | PendingRemoteAttachment;

export const AVAILABLE_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.2',
] as const;

export const AVAILABLE_REASONING_EFFORTS: readonly ReasoningEffort[] = [
  'low',
  'medium',
  'high',
  'xhigh',
] as const;

type RelayContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type RelayMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | RelayContentPart[];
};

type OpenAIMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

type RelayErrorInfo = {
  status: number;
  statusText: string;
  bodyText: string;
  bodyJson?: unknown;
};

type RelayMediaItem = {
  id?: string;
  fileName?: string;
  name?: string;
  contentType?: string;
  mimeType?: string;
  downloadUrl?: string;
  fileUrl?: string;
  uri?: string;
  previewUrl?: string;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildRelayEndpoint(baseUrl: string, path: string) {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const relayBaseUrl = normalizedBaseUrl.endsWith('/v1')
    ? normalizedBaseUrl.slice(0, -3)
    : normalizedBaseUrl;

  return `${relayBaseUrl}${path}`;
}

function createOpenAIClient(config: AgentConfig, sessionId: string) {
  return new OpenAI({
    apiKey: config.bearerToken,
    baseURL: config.baseUrl+"/v1",
    dangerouslyAllowBrowser: true,
    fetch: expoFetch as typeof fetch,
    defaultHeaders: {
      'x-session-id': sessionId,
    },
  });
}

async function readRelayError(response: Response): Promise<RelayErrorInfo> {
  const bodyText = await response.text();
  let bodyJson: unknown;

  try {
    bodyJson = bodyText ? JSON.parse(bodyText) : undefined;
  } catch {
    bodyJson = undefined;
  }

  return {
    status: response.status,
    statusText: response.statusText,
    bodyText,
    bodyJson,
  };
}

function extractRelayErrorMessage(errorInfo: RelayErrorInfo) {
  if (errorInfo.bodyJson && typeof errorInfo.bodyJson === 'object') {
    const typed = errorInfo.bodyJson as {
      error?: string;
      message?: string;
      detail?: string;
    };

    return typed.error || typed.message || typed.detail || '';
  }

  return errorInfo.bodyText.trim();
}

function logRelayError(label: string, details: Record<string, unknown>) {
  console.error(`[relay] ${label}`, details);
}

function toRelayMessages(messages: ChatMessage[], systemPrompt?: string): RelayMessage[] {
  const baseMessages = messages
    .filter(
      (message) => message.content.trim() || (message.attachments && message.attachments.length > 0),
    )
    .map<RelayMessage>((message) => ({
      role: message.role,
      content:
        message.attachments && message.attachments.length > 0
          ? [
              ...(message.content.trim()
                ? [{ type: 'text', text: message.content.trim() } satisfies RelayContentPart]
                : []),
              ...message.attachments.map(
                (attachment) =>
                  ({
                    type: 'image_url',
                    image_url: {
                      url: attachment.relayUrl || attachment.uri,
                    },
                  }) satisfies RelayContentPart,
              ),
            ]
          : message.content,
    }));

  return systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...baseMessages]
    : baseMessages;
}

function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const typed = payload as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ text?: string }>;
      };
      message?: {
        content?: string;
      };
    }>;
  };

  const choice = typed.choices?.[0];
  const deltaContent = choice?.delta?.content;

  if (typeof deltaContent === 'string') {
    return deltaContent;
  }

  if (Array.isArray(deltaContent)) {
    return deltaContent
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join('');
  }

  return typeof choice?.message?.content === 'string' ? choice.message.content : '';
}

async function requestFallbackCompletion(
  config: AgentConfig,
  sessionId: string,
  messages: RelayMessage[],
) {
  const client = createOpenAIClient(config, sessionId);

  try {
    const response = await client.chat.completions.create({
      model: config.model || 'gpt-5.4-mini',
      reasoning_effort: config.reasoningEffort || 'medium',
      messages: messages as OpenAIMessage[],
      stream: false,
    });

    return response.choices[0]?.message?.content || '';
  } catch (error) {
    const errorInfo = {
      status: 0,
      statusText: 'SDK request failed',
      bodyText: error instanceof Error ? error.message : 'Unknown SDK error',
      bodyJson: undefined,
    };
    logRelayError('chat completion fallback failed', {
      sessionId,
    url: `${config.baseUrl}/v1/chat/completions`,
      requestMessageCount: messages.length,
      response: errorInfo,
    });
    throw new Error(
      extractRelayErrorMessage(errorInfo) || 'Relay request failed.',
    );
  }
}

async function uploadAttachment(
  config: AgentConfig,
  attachment: PendingImageAttachment,
): Promise<ChatAttachment> {
  const response = await fetch(`${config.baseUrl}/v1/uploads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: attachment.fileName || `image-${attachment.id}.jpg`,
      contentType: attachment.mimeType || 'image/jpeg',
      base64: attachment.base64,
    }),
  });

  if (!response.ok) {
    const errorInfo = await readRelayError(response);
    logRelayError('attachment upload failed', {
      attachment: {
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        localUri: attachment.localUri,
        base64Length: attachment.base64.length,
      },
      url: `${config.baseUrl}/v1/uploads`,
      response: errorInfo,
    });
    throw new Error(
      extractRelayErrorMessage(errorInfo) || `Upload failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    id?: string;
    downloadUrl?: string;
    fileUrl?: string;
    contentType?: string;
  };

  if (!payload.fileUrl || !payload.id) {
    throw new Error('Upload did not return a usable file URL.');
  }

  return {
    id: attachment.id,
    type: 'image',
    uri: payload.downloadUrl || `${config.baseUrl}/v1/uploads/${payload.id}/file`,
    relayUrl: payload.fileUrl,
    previewUri: attachment.localUri,
    mimeType: payload.contentType || attachment.mimeType,
    fileName: attachment.fileName,
  };
}

async function toPendingImageAttachment(
  asset: ImagePicker.ImagePickerAsset,
): Promise<PendingImageAttachment | null> {
  const base64 =
    typeof asset.base64 === 'string' && asset.base64.length > 0
      ? asset.base64
      : await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

  if (!base64) {
    return null;
  }

  return {
    id: createId('attachment'),
    type: 'image',
    source: 'local',
    localUri: asset.uri,
    mimeType: asset.mimeType || 'image/jpeg',
    fileName: asset.fileName || asset.uri.split('/').pop() || 'image.jpg',
    base64,
  };
}

async function transcribeAudio(
  config: AgentConfig,
  audioUri: string,
  sessionId: string,
): Promise<string> {
  const candidateModels = ['gpt-4o-mini-transcribe', 'gpt-4o-transcribe', 'whisper-1'];
  let lastError: Error | null = null;

  for (const model of candidateModels) {
    try {
      const formData = new FormData();
      formData.append('model', model);
      formData.append('response_format', 'json');
      formData.append(
        'file',
        {
          uri: audioUri,
          name: `voice-note-${Date.now()}.m4a`,
          type: 'audio/mp4',
        } as never,
      );

      const response = await fetch(`${config.baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.bearerToken}`,
          'x-session-id': sessionId,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorInfo = await readRelayError(response);
        lastError = new Error(
          extractRelayErrorMessage(errorInfo) || `Transcription failed (${response.status})`,
        );
        continue;
      }

      const payload = (await response.json()) as { text?: string };
      const transcript = payload.text?.trim();

      if (transcript) {
        return transcript;
      }

      throw new Error('Voice transcription returned empty text.');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Voice transcription failed.');
    }
  }

  throw lastError ?? new Error('Voice transcription failed.');
}

export function useRelayChat(options: UseRelayChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(options.initialMessages ?? []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const abortRef = useRef<AbortController | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessagesRef = useRef<ChatMessage[]>(options.initialMessages ?? []);
  const hasLoadedHistoryRef = useRef(false);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    hasLoadedHistoryRef.current = hasLoadedHistory;
  }, [hasLoadedHistory]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }

      if (hasLoadedHistoryRef.current) {
        void saveChatMessages(options.sessionId, latestMessagesRef.current);
      }
    };
  }, [options.sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateMessages() {
      const storedMessages = await loadChatMessages(options.sessionId);

      if (cancelled) {
        return;
      }

      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      } else {
        setMessages(options.initialMessages ?? []);
      }

      setHasLoadedHistory(true);
    }

    void hydrateMessages();

    return () => {
      cancelled = true;
    };
  }, [options.initialMessages, options.sessionId]);

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
    }

    persistTimerRef.current = setTimeout(() => {
      void saveChatMessages(options.sessionId, messages);
    }, 160);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }
    };
  }, [hasLoadedHistory, messages, options.sessionId]);

  const addImageAttachment = useCallback(async () => {
    if (isStreaming) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      throw new Error('Photo library permission is required to attach images.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.85,
      base64: true,
      selectionLimit: 4,
    });

    if (result.canceled) {
      return;
    }

    const nextAttachments = (await Promise.all(
      result.assets.map((asset) => toPendingImageAttachment(asset)),
    )).filter((attachment): attachment is PendingImageAttachment => Boolean(attachment));

    setPendingAttachments((current) => [...current, ...nextAttachments]);
  }, [isStreaming]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }, []);

  const addExistingMediaAttachment = useCallback((media: RelayMediaItem) => {
    if (!media.id) {
      return;
    }

    const mediaUri =
      media.downloadUrl ||
      media.uri ||
      buildRelayEndpoint(options.config.baseUrl, `/v1/media/${encodeURIComponent(media.id)}/file`);

    setPendingAttachments((current) => [
      ...current,
      {
        id: createId('attachment-remote'),
        type: 'image',
        source: 'remote',
        uri: mediaUri,
        relayUrl: media.fileUrl || mediaUri,
        localUri: media.downloadUrl || media.previewUrl || mediaUri,
        mimeType: media.contentType || media.mimeType || 'image/jpeg',
        fileName: media.fileName || media.name || media.id,
      },
    ]);
  }, [options.config.baseUrl]);

  const startVoiceInput = useCallback(async () => {
    if (isStreaming || isTranscribingAudio || recorderState.isRecording) {
      return;
    }

    const permission = await requestRecordingPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Microphone permission needed', 'Enable microphone access to dictate messages.');
      return;
    }

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to start recording right now.';
      Alert.alert('Recording failed', message);
    }
  }, [audioRecorder, isStreaming, isTranscribingAudio, recorderState.isRecording]);

  const stopVoiceInput = useCallback(async () => {
    if (!recorderState.isRecording) {
      return;
    }

    try {
      await audioRecorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });

      const audioUri = audioRecorder.uri;

      if (!audioUri) {
        throw new Error('No recorded audio file was produced.');
      }

      setIsTranscribingAudio(true);
      const transcript = await transcribeAudio(options.config, audioUri, options.sessionId);

      setInput((current) => {
        const trimmedCurrent = current.trim();

        if (!trimmedCurrent) {
          return transcript;
        }

        return `${trimmedCurrent} ${transcript}`;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to transcribe that recording right now.';
      Alert.alert('Voice input failed', message);
    } finally {
      setIsTranscribingAudio(false);
    }
  }, [audioRecorder, options.config, options.sessionId, recorderState.isRecording]);

  const toggleVoiceInput = useCallback(async () => {
    if (recorderState.isRecording) {
      await stopVoiceInput();
      return;
    }

    await startVoiceInput();
  }, [recorderState.isRecording, startVoiceInput, stopVoiceInput]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    const hasAttachments = pendingAttachments.length > 0;

    if ((!trimmed && !hasAttachments) || isStreaming) {
      return;
    }

    abortRef.current?.abort();
    setIsStreaming(true);

    try {
      let uploadedAttachments: ChatAttachment[] = [];

      if (hasAttachments) {
        uploadedAttachments = await Promise.all(
          pendingAttachments.map(async (attachment) => {
            if (attachment.source === 'remote') {
              return {
                id: attachment.id,
                type: 'image' as const,
                uri: attachment.uri,
                relayUrl: attachment.relayUrl || attachment.uri,
                previewUri: attachment.localUri,
                mimeType: attachment.mimeType,
                fileName: attachment.fileName,
              };
            }

            return uploadAttachment(options.config, attachment);
          }),
        );
      }

      const userMessage: ChatMessage = {
        id: createId('user'),
        role: 'user',
        content: trimmed,
        attachments: uploadedAttachments,
        createdAt: new Date().toISOString(),
      };

      const assistantId = createId('assistant');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        streaming: true,
      };

      const nextMessages = [...messages, userMessage];
      const relayMessages = toRelayMessages(nextMessages, options.systemPrompt);

      setInput('');
      setPendingAttachments([]);
      setMessages((current) => [...current, userMessage, assistantMessage]);

      const abortController = new AbortController();
      abortRef.current = abortController;
      const client = createOpenAIClient(options.config, options.sessionId);

      const stream = await client.chat.completions.create(
        {
          model: options.config.model || 'gpt-5.4-mini',
          reasoning_effort: options.config.reasoningEffort || 'medium',
          messages: relayMessages as OpenAIMessage[],
          stream: true,
        },
        {
          signal: abortController.signal,
        },
      );

      let aggregated = '';

      for await (const chunk of stream) {
        const delta = extractStreamDelta(chunk);

        if (!delta) {
          continue;
        }

        aggregated += delta;

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: aggregated,
                  streaming: true,
                }
              : message,
          ),
        );
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: aggregated || 'No content returned.',
                streaming: false,
              }
            : message,
        ),
      );
    } catch (error) {
      if (abortRef.current?.signal.aborted) {
        return;
      }

      if (error instanceof OpenAI.APIError) {
        logRelayError('chat completion streaming request failed', {
          sessionId: options.sessionId,
          url: `${options.config.baseUrl}/v1/chat/completions`,
          requestMessageCount: messages.length + 1,
          response: {
            status: error.status ?? 0,
            statusText: error.name,
            bodyText: error.message,
            bodyJson: error.error,
          },
        });
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to reach the relay. Check your base URL and bearer token.';

      setMessages((current) => {
        if (current.some((message) => message.streaming)) {
          return current.map((message) =>
            message.streaming
              ? {
                  ...message,
                  content: errorMessage,
                  streaming: false,
                  error: true,
                }
              : message,
          );
        }

        return [
          ...current,
          {
            id: createId('assistant-error'),
            role: 'assistant',
            content: errorMessage,
            createdAt: new Date().toISOString(),
            error: true,
          },
        ];
      });
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, options]);

  return {
    addImageAttachment,
    addExistingMediaAttachment,
    hasLoadedHistory,
    input,
    isRecordingAudio: recorderState.isRecording,
    isStreaming,
    isTranscribingAudio,
    messages,
    pendingAttachments,
    removeAttachment,
    sendMessage,
    setInput,
    toggleVoiceInput,
    voiceDurationMillis: recorderState.durationMillis,
  };
}
