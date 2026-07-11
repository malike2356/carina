import type {
  HostedScoutStatus,
  KillSwitchStatus,
  KillSwitchTriggerResult,
  ScoutKeyResponse,
} from './types';

async function hostedScoutFetch<T>(
  baseUrl: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Scout proxy ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export function fetchHostedScoutStatus(baseUrl: string): Promise<HostedScoutStatus> {
  return hostedScoutFetch<HostedScoutStatus>(baseUrl, '/app/auth/scout/status');
}

export function fetchHostedKillSwitchStatus(baseUrl: string): Promise<KillSwitchStatus> {
  return hostedScoutFetch<KillSwitchStatus>(baseUrl, '/app/auth/scout/killswitch/status');
}

export function triggerHostedKillSwitch(
  baseUrl: string,
  reason: string,
): Promise<KillSwitchTriggerResult> {
  return hostedScoutFetch<KillSwitchTriggerResult>(baseUrl, '/app/auth/scout/killswitch/trigger', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export function fetchScoutKey(baseUrl: string): Promise<ScoutKeyResponse> {
  return hostedScoutFetch<ScoutKeyResponse>(baseUrl, '/app/auth/scout/key');
}
