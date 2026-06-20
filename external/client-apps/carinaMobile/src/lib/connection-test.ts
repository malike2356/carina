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

export async function testGatewayConnection(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<ConnectionTestResult> {
  const started = Date.now();
  try {
    const response = await fetch(
      `${baseUrl.replace(/\/+$/, '')}/api/health`,
      mergeGatewayInit(auth, { method: 'GET' }),
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

    const health = (await response.json()) as CarinaHealth;
    return {
      status: health.ok ? 'online' : 'offline',
      health,
      message: health.ok ? 'Connected' : 'Health check failed',
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
  }
}
