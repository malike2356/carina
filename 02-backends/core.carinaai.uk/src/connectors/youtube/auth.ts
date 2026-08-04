import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../../config/index.js';
import { YOUTUBE_OAUTH_SCOPES, type YouTubeTokenSet } from './types.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export { YOUTUBE_OAUTH_SCOPES };

export function isYouTubeOAuthConfigured(): boolean {
  return Boolean(
    config.propertyChannel.apiEnabled
      && config.propertyChannel.clientId
      && config.propertyChannel.clientSecret,
  );
}

export function resolveYouTubeRedirectUri(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  return (
    config.propertyChannel.redirectUri
    || 'http://localhost:7430/api/aiva/youtube/oauth/callback'
  );
}

function signingSecret(): string {
  return config.hosted.jwtSecret || process.env.CHANNEL_CREDENTIAL_KEY?.trim() || '';
}

export interface YouTubeOAuthStatePayload {
  workspaceId: string;
  channelId?: string;
  returnPath?: string;
  redirectUri: string;
  ts: number;
}

export function signYouTubeOAuthState(
  payload: Omit<YouTubeOAuthStatePayload, 'ts'>,
): string {
  const secret = signingSecret();
  if (!secret) throw new Error('OAuth signing secret is not configured');
  const body = Buffer.from(
    JSON.stringify({ ...payload, ts: Date.now() } satisfies YouTubeOAuthStatePayload),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyYouTubeOAuthState(
  state: string,
  maxAgeMs = 15 * 60 * 1000,
): YouTubeOAuthStatePayload | null {
  const secret = signingSecret();
  if (!secret) return null;
  const [body, sig] = state.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as YouTubeOAuthStatePayload;
    if (!parsed.workspaceId || !parsed.redirectUri || !parsed.ts) return null;
    if (Date.now() - parsed.ts > maxAgeMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildYouTubeAuthUrl(opts: {
  workspaceId: string;
  channelId?: string;
  redirectUri?: string;
  returnPath?: string;
}): { authUrl: string; redirectUri: string; scopes: readonly string[] } {
  if (!isYouTubeOAuthConfigured()) {
    throw new Error('YouTube OAuth is not configured on this server');
  }
  const redirectUri = resolveYouTubeRedirectUri(opts.redirectUri);
  const state = signYouTubeOAuthState({
    workspaceId: opts.workspaceId,
    channelId: opts.channelId,
    returnPath: opts.returnPath,
    redirectUri,
  });
  const params = new URLSearchParams({
    client_id: config.propertyChannel.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: YOUTUBE_OAUTH_SCOPES.join(' '),
    state,
  });
  return {
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    redirectUri,
    scopes: YOUTUBE_OAUTH_SCOPES,
  };
}

export async function exchangeYouTubeCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<YouTubeTokenSet> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: config.propertyChannel.clientId,
      client_secret: config.propertyChannel.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`YouTube OAuth code exchange failed with HTTP ${response.status}`);
  }
  const tokens = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!tokens.access_token) throw new Error('No access_token returned by Google OAuth');
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. Revoke Carina access at https://myaccount.google.com/permissions then try again.',
    );
  }
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    scope: tokens.scope ?? YOUTUBE_OAUTH_SCOPES.join(' '),
  };
}

export async function refreshYouTubeAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: number;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.propertyChannel.clientId,
      client_secret: config.propertyChannel.clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(`YouTube OAuth token refresh failed with HTTP ${response.status}`);
  }
  const tokens = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!tokens.access_token) throw new Error('No access_token returned on refresh');
  return {
    accessToken: tokens.access_token,
    expiresAt: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
  };
}
