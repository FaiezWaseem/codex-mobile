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
import { Alert, AppState, type AppStateStatus } from 'react-native';
import {
  loadChatMessages,
  loadChatSessionState,
  saveChatMessages,
  saveChatSessionState,
} from '../storage/chatDb';
import {
  executeLocalToolCall,
  LOCAL_TOOL_DEFINITIONS,
  shouldAttemptLocalTools,
} from '../tools/localTools';
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

type LocalToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type CompletionLoopMessage =
  | {
      role: 'system' | 'user' | 'assistant';
      content: string | RelayContentPart[];
      tool_calls?: LocalToolCall[];
    }
  | {
      role: 'tool';
      tool_call_id: string;
      name: string;
      content: string;
    };

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

type RelayJobPayload = {
  id?: string;
  jobId?: string;
  status?: string;
  error?: string;
  message?: string;
  detail?: string;
  data?: RelayJobPayload;
  job?: RelayJobPayload;
};

type RelayHistoryItem = {
  id?: string | number;
  role?: ChatMessage['role'] | 'system' | 'developer';
  content?: unknown;
  createdAt?: string;
  created_at?: string;
  sessionId?: string;
  route?: string;
  attachments?: Array<{
    id?: string;
    type?: string;
    uri?: string;
    relayUrl?: string;
    previewUri?: string;
    mimeType?: string;
    fileName?: string;
  }>;
};

type RelayHistoryPayload =
  | RelayHistoryItem[]
  | {
      object?: string;
      sessionId?: string;
      items?: RelayHistoryItem[];
      data?: RelayHistoryItem[];
      entries?: RelayHistoryItem[];
      messages?: RelayHistoryItem[];
      history?: RelayHistoryItem[];
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

function logRelayDebug(label: string, details: Record<string, unknown>) {
  console.log(`[relay] ${label}`, details);
}

async function fetchRelayJson<T>(
  config: AgentConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(buildRelayEndpoint(config.baseUrl, path), {
    ...init,
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorInfo = await readRelayError(response);
    throw new Error(
      extractRelayErrorMessage(errorInfo) || `Relay request failed (${response.status})`,
    );
  }

  return (await response.json()) as T;
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

function toCompletionLoopMessages(messages: ChatMessage[], systemPrompt?: string): CompletionLoopMessage[] {
  const baseMessages = toRelayMessages(messages, systemPrompt);
  return baseMessages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
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

function normalizeRelayTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((part) => {
      if (typeof part === 'string') {
        return part;
      }

      if (!part || typeof part !== 'object') {
        return '';
      }

      const typed = part as {
        text?: string;
        type?: string;
        value?: string;
        content?: string;
      };

      return (
        typed.text ||
        typed.value ||
        typed.content ||
        ''
      );
    })
    .join('');
}

function normalizeRelayAttachments(content: unknown, fallback?: RelayHistoryItem['attachments']) {
  const attachments: ChatAttachment[] = [];

  if (Array.isArray(fallback)) {
    attachments.push(
      ...fallback
        .filter((attachment) => (attachment.type || 'image') === 'image' && Boolean(attachment.uri))
        .map((attachment, index) => ({
          id: attachment.id || `attachment-${index}`,
          type: 'image' as const,
          uri: attachment.uri!,
          relayUrl: attachment.relayUrl,
          previewUri: attachment.previewUri,
          mimeType: attachment.mimeType,
          fileName: attachment.fileName,
        })),
    );
  }

  if (!Array.isArray(content)) {
    return attachments.length > 0 ? attachments : undefined;
  }

  content.forEach((part, index) => {
    if (!part || typeof part !== 'object') {
      return;
    }

    const typed = part as {
      type?: string;
      image_url?: { url?: string };
      fileName?: string;
      mimeType?: string;
    };

    if (typed.type !== 'image_url' || !typed.image_url?.url) {
      return;
    }

    attachments.push({
      id: `attachment-${index}`,
      type: 'image',
      uri: typed.image_url.url,
      relayUrl: typed.image_url.url,
      mimeType: typed.mimeType,
      fileName: typed.fileName,
    });
  });

  return attachments.length > 0 ? attachments : undefined;
}

function normalizeRelayHistory(payload: RelayHistoryPayload): ChatMessage[] {
  const items = Array.isArray(payload)
    ? payload
    : payload.history || payload.messages || payload.items || payload.data || [];
  const entries = Array.isArray(payload) ? [] : payload.entries || [];

  return items
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item, index) => {
      const matchingEntry = entries[index];

      return {
        id:
          String(item.id || matchingEntry?.id || `relay-${item.role}-${index}`),
        role: item.role as ChatMessage['role'],
        content: normalizeRelayTextContent(item.content),
        attachments: normalizeRelayAttachments(
          item.content,
          item.attachments || matchingEntry?.attachments,
        ),
        createdAt:
          item.createdAt ||
          item.created_at ||
          matchingEntry?.createdAt ||
          matchingEntry?.created_at ||
          new Date().toISOString(),
        streaming: false,
        error: false,
      };
    });
}

function getMessageSignature(message: ChatMessage) {
  return JSON.stringify({
    role: message.role,
    content: message.content,
    attachments:
      message.attachments?.map((attachment) => ({
        type: attachment.type,
        uri: attachment.uri,
        relayUrl: attachment.relayUrl,
        fileName: attachment.fileName,
      })) || [],
  });
}

function mergeRemoteHistoryWithLocal(currentMessages: ChatMessage[], remoteMessages: ChatMessage[]) {
  const mergedBySignature = new Map<string, ChatMessage>();

  currentMessages
    .filter((message) => !message.streaming && !message.error)
    .forEach((message) => {
      mergedBySignature.set(getMessageSignature(message), message);
    });

  remoteMessages.forEach((message) => {
    mergedBySignature.set(getMessageSignature(message), message);
  });

  return [...mergedBySignature.values()].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    if (Number.isNaN(leftTime) || Number.isNaN(rightTime) || leftTime === rightTime) {
      return 0;
    }

    return leftTime - rightTime;
  });
}

async function createRelayJob(
  config: AgentConfig,
  sessionId: string,
  messages: RelayMessage[],
): Promise<{ jobId: string }> {
  const payload = await fetchRelayJson<RelayJobPayload>(config, '/v1/jobs', {
    method: 'POST',
    body: JSON.stringify({
      route: '/v1/chat/completions',
      request: {
        sessionId,
        model: config.model || 'gpt-5.4-mini',
        reasoningEffort: config.reasoningEffort || 'medium',
        messages,
      },
    }),
  });

  const jobId =
    payload.id ||
    payload.jobId ||
    payload.data?.id ||
    payload.data?.jobId ||
    payload.job?.id ||
    payload.job?.jobId;

  logRelayDebug('create relay job response', {
    sessionId,
    jobId: jobId || null,
    response: payload,
  });

  if (!jobId) {
    logRelayError('create relay job missing id', {
      sessionId,
      response: payload,
    });
    throw new Error('Relay did not return a job id.');
  }

  return { jobId };
}

async function requestCompletionWithLocalTools(
  config: AgentConfig,
  sessionId: string,
  messages: CompletionLoopMessage[],
) {
  const response = await fetch(buildRelayEndpoint(config.baseUrl, '/v1/chat/completions'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-5.4-mini',
      reasoning_effort: config.reasoningEffort || 'medium',
      stream: false,
      tool_choice: 'auto',
      tools: LOCAL_TOOL_DEFINITIONS,
      messages,
    }),
  });

  if (!response.ok) {
    const errorInfo = await readRelayError(response);
    throw new Error(
      extractRelayErrorMessage(errorInfo) || `Relay request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        role?: 'assistant';
        content?: string | null;
        tool_calls?: LocalToolCall[];
      };
    }>;
  };

  return payload.choices?.[0]?.message;
}

async function resolveLocalToolConversation(
  config: AgentConfig,
  sessionId: string,
  baseMessages: CompletionLoopMessage[],
) {
  const workingMessages = [...baseMessages];

  for (let iteration = 0; iteration < 4; iteration += 1) {
    const assistantMessage = await requestCompletionWithLocalTools(config, sessionId, workingMessages);

    logRelayDebug('local tool completion response', {
      sessionId,
      iteration,
      hasToolCalls: Boolean(assistantMessage?.tool_calls?.length),
      contentPreview: assistantMessage?.content?.slice(0, 160) || '',
      toolCalls:
        assistantMessage?.tool_calls?.map((toolCall) => ({
          id: toolCall.id,
          name: toolCall.function.name,
        })) || [],
    });

    if (!assistantMessage) {
      return 'No content returned.';
    }

    const toolCalls = assistantMessage.tool_calls || [];

    if (toolCalls.length === 0) {
      return assistantMessage.content || 'No content returned.';
    }

    workingMessages.push({
      role: 'assistant',
      content: assistantMessage.content || '',
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const toolResult = await executeLocalToolCall(toolCall);

      logRelayDebug('local tool executed', {
        sessionId,
        toolName: toolCall.function.name,
        toolCallId: toolCall.id,
        resultPreview: toolResult.slice(0, 200),
      });

      workingMessages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: toolResult,
      });
    }
  }

  throw new Error('Local tool loop exceeded the maximum number of iterations.');
}

async function fetchRelayJob(config: AgentConfig, jobId: string) {
  const payload = await fetchRelayJson<RelayJobPayload>(
    config,
    `/v1/jobs/${encodeURIComponent(jobId)}`,
  );

  logRelayDebug('job status poll', {
    jobId,
    status: payload.status || payload.data?.status || payload.job?.status || null,
    payload,
  });

  return payload;
}

async function fetchRelaySessionHistory(config: AgentConfig, sessionId: string) {
  const payload = await fetchRelayJson<RelayHistoryPayload>(
    config,
    `/v1/sessions/${encodeURIComponent(sessionId)}/history`,
    {
      headers: {
        'x-session-id': sessionId,
      },
    },
  );

  logRelayDebug('session history fetched', {
    sessionId,
    historyCount: normalizeRelayHistory(payload).length,
  });

  return normalizeRelayHistory(payload);
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
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 200);
  const abortRef = useRef<AbortController | null>(null);
  const pendingJobIdRef = useRef<string | null>(null);
  const jobPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessagesRef = useRef<ChatMessage[]>(options.initialMessages ?? []);
  const hasLoadedHistoryRef = useRef(false);

  useEffect(() => {
    latestMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    pendingJobIdRef.current = pendingJobId;
  }, [pendingJobId]);

  useEffect(() => {
    hasLoadedHistoryRef.current = hasLoadedHistory;
  }, [hasLoadedHistory]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (jobPollTimerRef.current) {
        clearTimeout(jobPollTimerRef.current);
      }
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
      }

      if (hasLoadedHistoryRef.current) {
        void saveChatMessages(options.sessionId, latestMessagesRef.current);
        void saveChatSessionState(options.sessionId, {
          pendingJobId: pendingJobIdRef.current,
        });
      }
    };
  }, [options.sessionId]);

  const clearPendingJob = useCallback(async () => {
    pendingJobIdRef.current = null;
    setPendingJobId(null);
    await saveChatSessionState(options.sessionId, { pendingJobId: null });
  }, [options.sessionId]);

  const markPendingJob = useCallback(async (jobId: string) => {
    pendingJobIdRef.current = jobId;
    setPendingJobId(jobId);
    await saveChatSessionState(options.sessionId, { pendingJobId: jobId });
  }, [options.sessionId]);

  const replaceStreamingMessage = useCallback((content: string, error = false) => {
    setMessages((current) => {
      const hasStreamingMessage = current.some((message) => message.streaming);

      if (hasStreamingMessage) {
        return current.map((message) =>
          message.streaming
            ? {
                ...message,
                content,
                streaming: false,
                error,
              }
            : message,
        );
      }

      return [
        ...current,
        {
          id: createId(error ? 'assistant-error' : 'assistant'),
          role: 'assistant',
          content,
          createdAt: new Date().toISOString(),
          streaming: false,
          error,
        },
      ];
    });
  }, []);

  const syncMessagesFromRelay = useCallback(async () => {
    const remoteMessages = await fetchRelaySessionHistory(options.config, options.sessionId);

    logRelayDebug('incoming relay messages sync', {
      sessionId: options.sessionId,
      lastTwoMessages: remoteMessages.slice(-2).map((message) => ({
        id: message.id,
        role: message.role,
        contentPreview: message.content.slice(0, 160),
        createdAt: message.createdAt,
      })),
    });

    if (remoteMessages.length > 0) {
      setMessages((current) => {
        const mergedMessages = mergeRemoteHistoryWithLocal(current, remoteMessages);

        logRelayDebug('merged relay messages sync', {
          sessionId: options.sessionId,
          localCount: current.length,
          remoteCount: remoteMessages.length,
          mergedCount: mergedMessages.length,
          lastTwoMessages: mergedMessages.slice(-2).map((message) => ({
            id: message.id,
            role: message.role,
            contentPreview: message.content.slice(0, 160),
          })),
        });

        return mergedMessages;
      });
    }
  }, [options.config, options.sessionId]);

  const reconcilePendingJob = useCallback(async (jobId: string) => {
    try {
      const job = await fetchRelayJob(options.config, jobId);
      const jobStatus = (job.status || '').toLowerCase();

      logRelayDebug('incoming relay event listener', {
        mode: 'job-polling',
        sessionId: options.sessionId,
        jobId,
        status: jobStatus || 'unknown',
      });

      if (jobStatus === 'completed' || jobStatus === 'succeeded' || jobStatus === 'success') {
        await syncMessagesFromRelay();
        await clearPendingJob();
        setIsStreaming(false);
        return true;
      }

      if (jobStatus === 'failed' || jobStatus === 'cancelled' || jobStatus === 'canceled') {
        replaceStreamingMessage(
          job.error || job.message || job.detail || 'The relay job failed before it could finish.',
          true,
        );
        await clearPendingJob();
        setIsStreaming(false);
        return true;
      }
    } catch (error) {
      logRelayError('pending job reconcile failed', {
        sessionId: options.sessionId,
        jobId,
        message: error instanceof Error ? error.message : 'Unknown reconcile error',
      });
    }

    return false;
  }, [clearPendingJob, options.config, options.sessionId, replaceStreamingMessage, syncMessagesFromRelay]);

  const scheduleJobPolling = useCallback((jobId: string) => {
    if (jobPollTimerRef.current) {
      clearTimeout(jobPollTimerRef.current);
    }

    const poll = async () => {
      const finished = await reconcilePendingJob(jobId);

      if (finished || pendingJobIdRef.current !== jobId) {
        return;
      }

      jobPollTimerRef.current = setTimeout(() => {
        void poll();
      }, 2000);
    };

    jobPollTimerRef.current = setTimeout(() => {
      void poll();
    }, 1200);
  }, [reconcilePendingJob]);

  const syncRelayState = useCallback(async () => {
    const activePendingJobId = pendingJobIdRef.current;
    const hasStreamingMessage = latestMessagesRef.current.some((message) => message.streaming);

    if (activePendingJobId) {
      setIsStreaming(true);
      const finished = await reconcilePendingJob(activePendingJobId);

      if (!finished) {
        scheduleJobPolling(activePendingJobId);
      }

      return;
    }

    if (!hasStreamingMessage) {
      return;
    }

    try {
      await syncMessagesFromRelay();
    } finally {
      setMessages((current) =>
        current.map((message) =>
          message.streaming
            ? {
                ...message,
                streaming: false,
              }
            : message,
        ),
      );
      setIsStreaming(false);
    }
  }, [reconcilePendingJob, scheduleJobPolling, syncMessagesFromRelay]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateMessages() {
      const [storedMessages, storedState] = await Promise.all([
        loadChatMessages(options.sessionId),
        loadChatSessionState(options.sessionId),
      ]);

      if (cancelled) {
        return;
      }

      if (storedMessages.length > 0) {
        setMessages(storedMessages);
      } else {
        setMessages(options.initialMessages ?? []);
      }

      setPendingJobId(storedState.pendingJobId);
      pendingJobIdRef.current = storedState.pendingJobId;
      setHasLoadedHistory(true);

      const shouldSync =
        Boolean(storedState.pendingJobId) ||
        storedMessages.some((message) => message.streaming);

      if (shouldSync) {
        void syncRelayState();
      }
    }

    void hydrateMessages();

    return () => {
      cancelled = true;
    };
  }, [options.initialMessages, options.sessionId, syncRelayState]);

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

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    void saveChatSessionState(options.sessionId, {
      pendingJobId,
    });
  }, [hasLoadedHistory, options.sessionId, pendingJobId]);

  useEffect(() => {
    if (!hasLoadedHistory) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState !== 'active') {
        return;
      }

      if (
        pendingJobIdRef.current ||
        latestMessagesRef.current.some((message) => message.streaming)
      ) {
        void syncRelayState();
      }
    });

    return () => subscription.remove();
  }, [hasLoadedHistory, syncRelayState]);

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

  const deleteMessage = useCallback((messageId: string) => {
    setMessages((current) => current.filter((message) => message.id !== messageId));
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
    if (jobPollTimerRef.current) {
      clearTimeout(jobPollTimerRef.current);
    }
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

      logRelayDebug('chat send last two messages', {
        sessionId: options.sessionId,
        totalMessages: relayMessages.length,
        lastTwoMessages: relayMessages.slice(-2).map((message) => ({
          role: message.role,
          content:
            typeof message.content === 'string'
              ? message.content.slice(0, 200)
              : message.content.map((part) =>
                  part.type === 'text'
                    ? { type: part.type, text: part.text.slice(0, 200) }
                    : { type: part.type, url: part.image_url.url },
                ),
        })),
      });

      setInput('');
      setPendingAttachments([]);
      setMessages((current) => [...current, userMessage, assistantMessage]);
      void saveChatMessages(options.sessionId, [...messages, userMessage, assistantMessage]);

      if (shouldAttemptLocalTools(trimmed)) {
        logRelayDebug('chat send using local tool route', {
          sessionId: options.sessionId,
          inputPreview: trimmed.slice(0, 200),
        });

        const completionMessages = toCompletionLoopMessages(nextMessages, options.systemPrompt);
        const finalAssistantContent = await resolveLocalToolConversation(
          options.config,
          options.sessionId,
          completionMessages,
        );

        replaceStreamingMessage(finalAssistantContent, false);
        setIsStreaming(false);
        return;
      }

      const { jobId } = await createRelayJob(options.config, options.sessionId, relayMessages);
      await markPendingJob(jobId);
      scheduleJobPolling(jobId);
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

      replaceStreamingMessage(errorMessage, true);
      await clearPendingJob();
    } finally {
      abortRef.current = null;
    }
  }, [
    clearPendingJob,
    input,
    isStreaming,
    markPendingJob,
    messages,
    options,
    pendingAttachments,
    replaceStreamingMessage,
    scheduleJobPolling,
  ]);

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
    deleteMessage,
    removeAttachment,
    sendMessage,
    setInput,
    toggleVoiceInput,
    voiceDurationMillis: recorderState.durationMillis,
  };
}
