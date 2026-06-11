import { useCallback, useRef, useState } from 'react';
import { streamChat } from '@/api/chat-stream';
import { useAuth } from '@/store/auth-store';
import { setSessionId } from '@/store/instance-store';

interface UseChatStreamResult {
  streaming: boolean;
  error: string | null;
  partial: string;
  send: (message: string) => Promise<string>;
  cancel: () => void;
}

export function useChatStream(): UseChatStreamResult {
  const { client, instance } = useAuth();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (message: string): Promise<string> => {
      if (!client || !instance) {
        throw new Error('No Carina instance configured');
      }

      cancel();
      const controller = new AbortController();
      abortRef.current = controller;

      setStreaming(true);
      setError(null);
      setPartial('');

      try {
        const full = await streamChat({
          baseUrl: instance.baseUrl,
          message,
          sessionId: instance.sessionId || undefined,
          credentials: instance.mode === 'cloud' ? 'include' : 'omit',
          signal: controller.signal,
          onChunk: (chunk) => {
            if (chunk.content) {
              setPartial((prev) => prev + chunk.content);
            }
          },
        });

        if (!instance.sessionId) {
          await setSessionId(`mobile-${Date.now()}`);
        }

        return full;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [cancel, client, instance],
  );

  return { streaming, error, partial, send, cancel };
}
