import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadChatMessages, saveChatMessages } from '../storage/chatDb';
import type { AgentConfig, ChatAttachment, ChatMessage } from '../types';

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
  localUri: string;
  mimeType?: string;
  fileName?: string;
  base64: string;
};

type RelayContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type RelayMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | RelayContentPart[];
};

type RelayErrorInfo = {
  status: number;
  statusText: string;
  bodyText: string;
  bodyJson?: unknown;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.bearerToken}`,
      'Content-Type': 'application/json',
      'x-session-id': sessionId,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-5.4-mini',
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errorInfo = await readRelayError(response);
    logRelayError('chat completion fallback failed', {
      sessionId,
      url: `${config.baseUrl}/v1/chat/completions`,
      requestMessageCount: messages.length,
      response: errorInfo,
    });
    throw new Error(
      extractRelayErrorMessage(errorInfo) || `Relay request failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  return payload.choices?.[0]?.message?.content || '';
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
    fileUrl?: string;
    contentType?: string;
  };

  if (!payload.fileUrl || !payload.id) {
    throw new Error('Upload did not return a usable file URL.');
  }

  return {
    id: attachment.id,
    type: 'image',
    uri: `${config.baseUrl}/v1/uploads/${payload.id}/file`,
    relayUrl: payload.fileUrl,
    previewUri: attachment.localUri,
    mimeType: payload.contentType || attachment.mimeType,
    fileName: attachment.fileName,
  };
}

export function useRelayChat(options: UseRelayChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(options.initialMessages ?? []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingImageAttachment[]>([]);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
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

    const nextAttachments = result.assets
      .filter((asset) => typeof asset.base64 === 'string' && asset.base64.length > 0)
      .map<PendingImageAttachment>((asset) => ({
        id: createId('attachment'),
        type: 'image',
        localUri: asset.uri,
        mimeType: asset.mimeType || 'image/jpeg',
        fileName: asset.fileName || asset.uri.split('/').pop() || 'image.jpg',
        base64: asset.base64 as string,
      }));

    setPendingAttachments((current) => [...current, ...nextAttachments]);
  }, [isStreaming]);

  const removeAttachment = useCallback((attachmentId: string) => {
    setPendingAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }, []);

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
          pendingAttachments.map((attachment) => uploadAttachment(options.config, attachment)),
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

      const response = await fetch(`${options.config.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.config.bearerToken}`,
          'Content-Type': 'application/json',
          'x-session-id': options.sessionId,
        },
        body: JSON.stringify({
          model: options.config.model || 'gpt-5.4-mini',
          messages: relayMessages,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorInfo = await readRelayError(response);
        logRelayError('chat completion streaming request failed', {
          sessionId: options.sessionId,
          url: `${options.config.baseUrl}/v1/chat/completions`,
          requestMessageCount: relayMessages.length,
          attachments: userMessage.attachments,
          response: errorInfo,
        });
        throw new Error(
          extractRelayErrorMessage(errorInfo) || `Relay request failed (${response.status})`,
        );
      }

      if (!response.body) {
        const fallbackContent = await requestFallbackCompletion(
          options.config,
          options.sessionId,
          relayMessages,
        );

        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: fallbackContent,
                  streaming: false,
                }
              : message,
          ),
        );

        setIsStreaming(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let aggregated = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const lines = event
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);

          for (const line of lines) {
            if (!line.startsWith('data:')) {
              continue;
            }

            const payload = line.slice(5).trim();

            if (!payload || payload === '[DONE]') {
              continue;
            }

            const parsed = JSON.parse(payload) as unknown;
            const delta = extractStreamDelta(parsed);

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
        }
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
    hasLoadedHistory,
    input,
    isStreaming,
    messages,
    pendingAttachments,
    removeAttachment,
    sendMessage,
    setInput,
  };
}
