import { useCallback, useRef, useState } from 'react';
import type { ChatMessage } from '@/api/types';
import { localChatStream } from '@/lib/local-inference';

export function useLocalChat() {
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(async (message: string, history: ChatMessage[]): Promise<string> => {
    const text = message.trim();
    if (!text) return '';

    cancel();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);
    setError(null);
    setPartial('');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
      status: 'done',
    };
    const transcript = [...history, userMessage];
    let buffer = '';

    try {
      for await (const token of localChatStream(transcript, controller.signal)) {
        buffer += token;
        setPartial(buffer);
      }
      return buffer;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!controller.signal.aborted) {
        setError(msg);
      }
      throw err;
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [cancel]);

  return {
    streaming,
    error,
    partial,
    send,
    cancel,
  };
}
