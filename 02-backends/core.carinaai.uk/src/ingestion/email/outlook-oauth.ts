import { config } from '../../config/index.js';

const OUTLOOK_SCOPES = [
  'https://outlook.office.com/IMAP.AccessAsUser.All',
  'offline_access',
  'openid',
  'email',
].join(' ');

function tokenEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
}

function authEndpoint(tenantId: string): string {
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`;
}

function assertConfigured(): void {
  if (!config.microsoftOAuth.clientId || !config.microsoftOAuth.clientSecret) {
    throw new Error('Microsoft OAuth is not configured on this server');
  }
}

export function isOutlookOAuthConfigured(): boolean {
  return Boolean(config.microsoftOAuth.clientId && config.microsoftOAuth.clientSecret);
}

export function getOutlookAuthUrl(state: string, codeChallenge?: string): string {
  assertConfigured();
  const { clientId, tenantId, redirectUri } = config.microsoftOAuth;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: OUTLOOK_SCOPES,
    state,
  });
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', 'S256');
  }
  return `${authEndpoint(tenantId)}?${params.toString()}`;
}

export interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
}

export async function exchangeOutlookCodeForTokens(code: string, codeVerifier?: string): Promise<OutlookTokens> {
  assertConfigured();
  const { clientId, clientSecret, tenantId, redirectUri } = config.microsoftOAuth;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });
  if (codeVerifier) {
    body.set('code_verifier', codeVerifier);
  }

  const response = await fetch(tokenEndpoint(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft token exchange failed: ${text}`);
  }

  const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    id_token?: string;
  };
  if (!data.access_token) {
    throw new Error('No access_token returned by Microsoft OAuth');
  }
  if (!data.refresh_token) {
    throw new Error('No refresh_token returned. Ensure offline_access scope is requested.');
  }

  const email = decodeEmailFromIdToken(data.id_token ?? '') ?? '';
  if (!email) {
    throw new Error('Could not determine email address from Microsoft id_token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiryDate: Date.now() + Math.max(0, data.expires_in ?? 0) * 1000,
    email,
  };
}

export async function refreshOutlookAccessToken(refreshToken: string): Promise<string> {
  assertConfigured();
  const { clientId, clientSecret, tenantId } = config.microsoftOAuth;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: OUTLOOK_SCOPES,
  });

  const response = await fetch(tokenEndpoint(tenantId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft token refresh failed: ${text}`);
  }

  const data = await response.json() as { access_token?: string };
  if (!data.access_token) {
    throw new Error('No access_token returned by Microsoft OAuth refresh');
  }
  return data.access_token;
}

export function decodeEmailFromIdToken(idToken: string): string | null {
  try {
    const [, payload] = idToken.split('.');
    if (!payload) return null;
    const json = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
    const value = json.preferred_username ?? json.email ?? json.upn ?? '';
    return typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null;
  } catch {
    return null;
  }
}
