import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';

export interface PairingDevice {
  id: string;
  name: string;
  platform: string;
  pairedAt?: string;
  lastSeenAt?: string;
  lastSeen?: string;
  scopes?: string[];
}

function pairingHeaders(): HeadersInit {
  const token = resolveCoreProxyToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-internal-key'] = token;
  }
  return headers;
}

async function corePairingFetch(path: string, init?: RequestInit): Promise<Response> {
  if (!coreProxyEnabled()) {
    throw new Error('Core proxy is not configured');
  }

  const coreUrl = resolveCoreUrl().replace(/\/$/, '');
  return fetch(`${coreUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      ...pairingHeaders(),
    },
    signal: AbortSignal.timeout(5000),
  });
}

export async function createPairingCode(): Promise<{ code: string; expiresAt: string; expiresInMinutes: number }> {
  const response = await corePairingFetch('/api/pairing/code', { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Pairing code request failed (${response.status})`);
  }
  return response.json();
}

export async function acceptPairingToken(input: {
  token: string;
  deviceName: string;
  deviceId?: string;
  platform?: string;
}): Promise<Record<string, unknown>> {
  const response = await corePairingFetch('/api/pair/accept', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.error === 'string'
      ? payload.error
      : `Pairing failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

export async function listPairingDevices(): Promise<PairingDevice[]> {
  const response = await corePairingFetch('/api/pair/devices');
  if (!response.ok) {
    throw new Error(`Device lookup failed (${response.status})`);
  }
  return response.json();
}

export async function getPendingPairing(): Promise<{ pending: { expiresAt: string } | null }> {
  const response = await corePairingFetch('/api/pairing/pending');
  if (!response.ok) {
    throw new Error(`Pairing state request failed (${response.status})`);
  }
  return response.json();
}

export async function revokePairingDevice(id: string): Promise<void> {
  const response = await corePairingFetch(`/api/pair/devices/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to revoke device (${response.status})`);
  }
}
