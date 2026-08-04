import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import {
  ConnectionService,
  isBackgroundConnectionAvailable,
} from '@/lib/connection-service';
import { DEFAULT_CLOUD_URL } from '@/config/defaults';
import { gatewayWebSocketUrl } from '@/lib/gateway-ws-url';
import { testGatewayConnection, type ConnectionStatus } from '@/lib/connection-test';

const POLL_MS = 45_000;
const NATIVE_POLL_MS = 120_000;

function isCloudGateway(baseUrl: string): boolean {
  return baseUrl.replace(/\/+$/, '') === DEFAULT_CLOUD_URL.replace(/\/+$/, '');
}

function authFingerprint(auth?: GatewayAuthOptions): string {
  return [auth?.credentials ?? '', auth?.apiKey ?? '', auth?.deviceToken ?? ''].join('|');
}

export function useConnectionStatus(baseUrl: string | undefined, auth?: GatewayAuthOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [message, setMessage] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeConnectedRef = useRef(false);
  const checkSeqRef = useRef(0);
  const hasResolvedRef = useRef(false);
  const authKey = useMemo(() => authFingerprint(auth), [auth?.apiKey, auth?.credentials, auth?.deviceToken]);
  const authRef = useRef(auth);
  authRef.current = auth;

  const check = useCallback(async () => {
    if (!baseUrl) {
      hasResolvedRef.current = true;
      setStatus('offline');
      setMessage('No gateway configured');
      return;
    }

    const seq = ++checkSeqRef.current;
    // Keep the last known chip label while revalidating; only flash "Checking" once.
    if (!hasResolvedRef.current) {
      setStatus('checking');
    }

    const result = await testGatewayConnection(baseUrl, authRef.current);
    if (seq !== checkSeqRef.current) return;

    hasResolvedRef.current = true;
    setStatus(result.status);
    setMessage(result.message);
    setLatencyMs(result.latencyMs);
  }, [baseUrl]);

  useEffect(() => {
    hasResolvedRef.current = false;
    checkSeqRef.current += 1;

    if (!baseUrl || !isBackgroundConnectionAvailable() || isCloudGateway(baseUrl)) {
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
          hasResolvedRef.current = true;
          setStatus('online');
          setMessage('Connected (background service)');
        } else if (event.state === 'disconnected') {
          nativeConnectedRef.current = false;
          hasResolvedRef.current = true;
          setStatus('offline');
          setMessage(event.error ?? event.reason ?? 'Background connection lost');
        }
        // Ignore "closing" / "connecting" to avoid chip flicker during reconnect.
      }),
      ConnectionService.onAgentEvent(() => {
        // Global handlers receive events via registerAgentEventHandler.
      }),
    ];

    void ConnectionService.start(wsUrl).catch((err: unknown) => {
      if (!active) return;
      const msg = err instanceof Error ? err.message : String(err);
      hasResolvedRef.current = true;
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
  }, [authKey, baseUrl, check]);

  return { status, message, latencyMs, refresh: check };
}
