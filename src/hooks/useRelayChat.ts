import { useCallback, useEffect, useRef, useState } from 'react';
import { loadChatMessages, saveChatMessages } from '../storage/chatDb';
import type { AgentConfig, ChatMessage } from '../types';

type UseRelayChatOptions = {
  assistantName?: string;
  config: AgentConfig;
  initialMessages?: ChatMessage[];
  reloadKey?: number;
  sessionId: string;
  systemPrompt?: string;
};

type RelayMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function toRelayMessages(messages: ChatMessage[], systemPrompt?: string): RelayMessage[] {
  const baseMessages = messages
    .filter((message) => message.content.trim())
    .map<RelayMessage>((message) => ({
      role: message.role,
      content: message.content,
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
    throw new Error(`Relay request failed (${response.status})`);
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

export function useRelayChat(options: UseRelayChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(options.initialMessages ?? []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
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
  }, [options.initialMessages, options.reloadKey, options.sessionId]);

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

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();

    if (!trimmed || isStreaming) {
      return;
    }

    abortRef.current?.abort();

    const userMessage: ChatMessage = {
      id: createId('user'),
      role: 'user',
      content: trimmed,
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
    setIsStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
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
        throw new Error(`Relay request failed (${response.status})`);
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
      if (abortController.signal.aborted) {
        return;
      }

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to reach the relay. Check your base URL and bearer token.';

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: errorMessage,
                streaming: false,
                error: true,
              }
            : message,
        ),
      );
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }

      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, options]);

  return {
    hasLoadedHistory,
    input,
    isStreaming,
    messages,
    sendMessage,
    setInput,
  };
}
