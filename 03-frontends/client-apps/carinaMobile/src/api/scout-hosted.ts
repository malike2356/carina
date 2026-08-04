import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import type {
  HostedScoutStatus,
  KillSwitchStatus,
  KillSwitchTriggerResult,
  ScoutKeyResponse,
} from './types';

function formatScoutError(status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('self.__next_f')) {
    return `Scout proxy ${status}: endpoint missing or returned HTML instead of JSON.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return `Scout proxy ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  const short = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
  return `Scout proxy ${status}: ${short || statusText}`;
}

async function hostedScoutFetch<T>(
  baseUrl: string,
  path: string,
  auth?: GatewayAuthOptions,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}${path}`,
    mergeGatewayInit(auth, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    }),
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(formatScoutError(response.status, body, response.statusText));
  }

  return response.json() as Promise<T>;
}

export function fetchHostedScoutStatus(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<HostedScoutStatus> {
  return hostedScoutFetch<HostedScoutStatus>(baseUrl, '/app/auth/scout/status', auth);
}

export function fetchHostedKillSwitchStatus(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<KillSwitchStatus> {
  return hostedScoutFetch<KillSwitchStatus>(
    baseUrl,
    '/app/auth/scout/killswitch/status',
    auth,
  );
}

export function triggerHostedKillSwitch(
  baseUrl: string,
  reason: string,
  auth?: GatewayAuthOptions,
): Promise<KillSwitchTriggerResult> {
  return hostedScoutFetch<KillSwitchTriggerResult>(
    baseUrl,
    '/app/auth/scout/killswitch/trigger',
    auth,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export function fetchScoutKey(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<ScoutKeyResponse> {
  return hostedScoutFetch<ScoutKeyResponse>(baseUrl, '/app/auth/scout/key', auth);
}
