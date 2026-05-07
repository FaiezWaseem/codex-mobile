import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../types';

type UseMockChatOptions = {
  assistantName?: string;
  systemPrompt?: string;
  initialMessages?: ChatMessage[];
};

function createId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowLabel() {
  return new Date().toISOString();
}

function buildReply(input: string, options?: UseMockChatOptions) {
  const assistantName = options?.assistantName ?? 'Codex';
  const contextLine = options?.systemPrompt
    ? `I am keeping the response aligned with: ${options.systemPrompt}.`
    : 'I can help you shape the next step, break the work down, or draft an implementation plan.';

  return `${assistantName} here. I received: "${input}". ${contextLine} For this prototype, I am streaming a dummy reply so the UI behaves like a real chat. If you want, the next message can trigger a richer mock plan, code outline, or task summary.`;
}

export function useMockChat(options?: UseMockChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(options?.initialMessages ?? []);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStream = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => clearStream, [clearStream]);

  const sendMessage = useCallback(() => {
    const trimmed = input.trim();

    if (!trimmed || isStreaming) {
      return;
    }

    clearStream();

    const userMessage: ChatMessage = {
      id: createId('user'),
      role: 'user',
      content: trimmed,
      createdAt: nowLabel(),
    };

    const assistantId = createId('assistant');
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: nowLabel(),
      streaming: true,
    };

    const fullReply = buildReply(trimmed, options);
    let cursor = 0;

    setInput('');
    setIsStreaming(true);
    setMessages((current) => [...current, userMessage, assistantMessage]);

    intervalRef.current = setInterval(() => {
      cursor += 3;
      const nextSlice = fullReply.slice(0, cursor);
      const finished = cursor >= fullReply.length;

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: nextSlice,
                streaming: !finished,
              }
            : message,
        ),
      );

      if (finished) {
        clearStream();
        setIsStreaming(false);
      }
    }, 28);
  }, [clearStream, input, isStreaming, options]);

  return {
    input,
    isStreaming,
    messages,
    sendMessage,
    setInput,
  };
}
