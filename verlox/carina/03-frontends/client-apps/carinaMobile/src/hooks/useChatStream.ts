import { useCallback, useRef, useState } from 'react';
import { streamChat } from '@/api/chat-stream';
import { useAuth } from '@/store/auth-store';
import { ensureSessionId } from '@/store/instance-store';

interface UseChatStreamResult {
  streaming: boolean;
  error: string | null;
  partial: string;
  send: (message: string) => Promise<string>;
  cancel: () => void;
}

/** Lightweight stream hook for tests and future screens. Prefer useChatSession for chat UI. */
export function useChatStream(): UseChatStreamResult {
  const { client, instance, gatewayAuth, setInstance } = useAuth();
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

      const sessionConfig = instance.sessionId
        ? instance
        : await ensureSessionId();

      if (!instance.sessionId) {
        setInstance(sessionConfig);
      }

      try {
        const full = await streamChat({
          baseUrl: instance.baseUrl,
          message,
          sessionId: sessionConfig.sessionId,
          credentials: gatewayAuth?.credentials ?? 'omit',
          apiKey: gatewayAuth?.apiKey ?? undefined,
          signal: controller.signal,
          onChunk: (chunk) => {
            if (chunk.content) {
              setPartial((prev) => prev + chunk.content);
            }
          },
        });

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
    [cancel, client, gatewayAuth, instance, setInstance],
  );

  return { streaming, error, partial, send, cancel };
}
