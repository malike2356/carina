import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { testGatewayConnection, type ConnectionStatus } from '@/lib/connection-test';

const POLL_MS = 45_000;

export function useConnectionStatus(baseUrl: string | undefined, auth?: GatewayAuthOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!baseUrl) {
      setStatus('offline');
      setMessage('No gateway configured');
      return;
    }
    setStatus('checking');
    const result = await testGatewayConnection(baseUrl, auth);
    setStatus(result.status);
    setMessage(result.message);
    setLatencyMs(result.latencyMs);
  }, [auth, baseUrl]);

  useEffect(() => {
    void check();
    timerRef.current = setInterval(() => {
      void check();
    }, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [check]);

  return { status, message, latencyMs, refresh: check };
}
