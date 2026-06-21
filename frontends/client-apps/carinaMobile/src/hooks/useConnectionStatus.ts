import { useCallback, useEffect, useRef, useState } from 'react';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import {
  ConnectionService,
  isBackgroundConnectionAvailable,
} from '@/lib/connection-service';
import { gatewayWebSocketUrl } from '@/lib/gateway-ws-url';
import { testGatewayConnection, type ConnectionStatus } from '@/lib/connection-test';

const POLL_MS = 45_000;
const NATIVE_POLL_MS = 120_000;

export function useConnectionStatus(baseUrl: string | undefined, auth?: GatewayAuthOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeConnectedRef = useRef(false);

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
    if (!baseUrl || !isBackgroundConnectionAvailable()) {
      void check();
      timerRef.current = setInterval(() => {
        void check();
      }, POLL_MS);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }

    let active = true;
    const wsUrl = gatewayWebSocketUrl(baseUrl);
    const subscriptions = [
      ConnectionService.onConnectionStateChange((event) => {
        if (!active) return;
        if (event.state === 'connected') {
          nativeConnectedRef.current = true;
          setStatus('online');
          setMessage('Connected (background service)');
        } else if (event.state === 'disconnected' || event.state === 'closing') {
          nativeConnectedRef.current = false;
          setStatus('offline');
          setMessage(event.error ?? event.reason ?? 'Background connection lost');
        }
      }),
      ConnectionService.onAgentEvent(() => {
        // Global handlers receive events via registerAgentEventHandler.
      }),
    ];

    void ConnectionService.start(wsUrl).catch((err: unknown) => {
      if (!active) return;
      const msg = err instanceof Error ? err.message : String(err);
      setStatus('offline');
      setMessage(`Background connection failed: ${msg}`);
    });

    void check();
    timerRef.current = setInterval(() => {
      if (!nativeConnectedRef.current) {
        void check();
      }
    }, NATIVE_POLL_MS);

    return () => {
      active = false;
      subscriptions.forEach((sub) => sub?.remove());
      void ConnectionService.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [baseUrl, check]);

  return { status, message, latencyMs, refresh: check };
}
