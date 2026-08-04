import { deleteOAuthToken, getOAuthToken, setOAuthToken } from './store.js';
import {
  OAUTH_PROVIDER_MAP,
  isOAuthProviderConfigured,
  oauthClientCredentials,
} from './oauth-providers.js';
import type { DeviceCodeResponse, OAuthTokenResponse } from './types.js';

export interface DeviceFlowStart {
  provider: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  expiresIn: number;
  interval: number;
  deviceCode: string;
}

export interface DeviceFlowPollResult {
  status: 'pending' | 'success' | 'expired' | 'error';
  message?: string;
  accessToken?: string;
}

function formBody(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`OAuth response parse failed (${res.status}): ${text.slice(0, 200)}`);
  }
}

export async function startDeviceFlow(providerName: string): Promise<DeviceFlowStart> {
  const def = OAUTH_PROVIDER_MAP[providerName];
  if (!def) throw new Error(`Unknown OAuth provider: ${providerName}`);
  if (!isOAuthProviderConfigured(def)) {
    throw new Error(`Set ${def.clientIdEnv} before OAuth login`);
  }

  const { clientId } = oauthClientCredentials(def);
  const body: Record<string, string> = {
    client_id: clientId,
    scope: def.scope,
  };
  if (def.audience) body.audience = def.audience;

  const res = await fetch(def.deviceCodeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formBody(body),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Device code request failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const payload = await parseJsonResponse<DeviceCodeResponse & { error?: string; error_description?: string }>(res);
  if (payload.error) {
    throw new Error(payload.error_description ?? payload.error);
  }

  return {
    provider: providerName,
    userCode: payload.user_code,
    verificationUri: payload.verification_uri,
    verificationUriComplete: payload.verification_uri_complete,
    expiresIn: payload.expires_in,
    interval: payload.interval ?? 5,
    deviceCode: payload.device_code,
  };
}

export async function pollDeviceFlow(
  providerName: string,
  deviceCode: string,
): Promise<DeviceFlowPollResult> {
  const def = OAUTH_PROVIDER_MAP[providerName];
  if (!def) return { status: 'error', message: `Unknown provider: ${providerName}` };

  const { clientId, clientSecret } = oauthClientCredentials(def);
  const body: Record<string, string> = {
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
    client_id: clientId,
  };
  if (clientSecret) body.client_secret = clientSecret;

  const res = await fetch(def.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formBody(body),
  });

  const payload = await parseJsonResponse<OAuthTokenResponse>(res);

  if (payload.error === 'authorization_pending') {
    return { status: 'pending' };
  }
  if (payload.error === 'slow_down') {
    return { status: 'pending', message: 'slow_down' };
  }
  if (payload.error === 'expired_token') {
    return { status: 'expired', message: payload.error_description ?? 'expired_token' };
  }
  if (payload.error || !payload.access_token) {
    return {
      status: 'error',
      message: payload.error_description ?? payload.error ?? `HTTP ${res.status}`,
    };
  }

  const obtainedAt = Date.now();
  setOAuthToken(providerName, {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: payload.expires_in ? obtainedAt + payload.expires_in * 1000 : undefined,
    scope: payload.scope,
    tokenType: payload.token_type,
    obtainedAt,
  });

  return { status: 'success', accessToken: payload.access_token };
}

export async function runDeviceFlowInteractive(
  providerName: string,
  opts: {
    onPrompt?: (info: DeviceFlowStart) => void;
    pollMs?: (interval: number) => number;
    sleep?: (ms: number) => Promise<void>;
    maxWaitMs?: number;
  } = {},
): Promise<string> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const pollMs = opts.pollMs ?? ((interval: number) => Math.max(interval, 5) * 1000);
  const maxWaitMs = opts.maxWaitMs ?? 15 * 60 * 1000;

  const start = await startDeviceFlow(providerName);
  opts.onPrompt?.(start);

  const deadline = Date.now() + Math.min(start.expiresIn * 1000, maxWaitMs);
  let interval = start.interval;

  while (Date.now() < deadline) {
    await sleep(pollMs(interval));
    const result = await pollDeviceFlow(providerName, start.deviceCode);
    if (result.status === 'success' && result.accessToken) return result.accessToken;
    if (result.status === 'expired') {
      throw new Error(result.message ?? 'Device code expired');
    }
    if (result.status === 'error') {
      throw new Error(result.message ?? 'OAuth device flow failed');
    }
    if (result.message === 'slow_down') interval += 5;
  }

  throw new Error('OAuth device flow timed out');
}

export function getValidOAuthAccessToken(providerName: string): string | null {
  const token = getOAuthToken(providerName);
  if (!token) return null;
  if (token.expiresAt && token.expiresAt <= Date.now() + 60_000) return null;
  return token.accessToken;
}

export function revokeOAuthToken(providerName: string): void {
  deleteOAuthToken(providerName);
}

export function describeOAuthSessions(): Array<{
  name: string;
  displayName: string;
  configured: boolean;
  loggedIn: boolean;
  expiresAt?: number;
  scope?: string;
}> {
  return Object.values(OAUTH_PROVIDER_MAP).map((def) => {
    const token = getOAuthToken(def.name);
    return {
      name: def.name,
      displayName: def.displayName,
      configured: isOAuthProviderConfigured(def),
      loggedIn: Boolean(token?.accessToken),
      expiresAt: token?.expiresAt,
      scope: token?.scope,
    };
  });
}
