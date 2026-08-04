import type { CarinaHealth } from '@/api/types';
import type { GatewayAuthOptions } from './gateway-auth';
import { mergeGatewayInit } from './gateway-auth';

export type ConnectionStatus = 'online' | 'offline' | 'auth-error' | 'checking';

export interface ConnectionTestResult {
  status: ConnectionStatus;
  health: CarinaHealth | null;
  message: string;
  latencyMs: number;
}

const CONNECTION_TIMEOUT_MS = 8_000;

export async function testGatewayConnection(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<ConnectionTestResult> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/health`,
      mergeGatewayInit(auth, { method: 'GET', signal: controller.signal }),
    );
    const latencyMs = Date.now() - started;

    if (response.status === 401 || response.status === 403) {
      return {
        status: 'auth-error',
        health: null,
        message: 'Gateway reachable but API key or auth was rejected.',
        latencyMs,
      };
    }

    if (!response.ok) {
      return {
        status: 'offline',
        health: null,
        message: `Gateway returned ${response.status}.`,
        latencyMs,
      };
    }

    const health = (await response.json()) as CarinaHealth & { status?: string };
    const healthy = health.ok === true || health.status === 'ok';
    return {
      status: healthy ? 'online' : 'offline',
      health: { ...health, ok: healthy },
      message: healthy ? 'Connected' : 'Health check failed',
      latencyMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'offline',
      health: null,
      message: msg.includes('Network request failed')
        ? 'Cannot reach gateway. Check URL and network.'
        : msg,
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timeout);
  }
}
