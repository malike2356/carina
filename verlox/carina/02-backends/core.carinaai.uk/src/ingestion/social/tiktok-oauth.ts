import { config } from '../../config/index.js';

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
/** Pin scopes; add business messaging scopes when TikTok app review grants them. */
export const TIKTOK_OAUTH_SCOPES = ['user.info.basic'];

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  openId: string;
}

function clientKey(): string {
  return config.socialOAuth.tiktok.clientKey;
}

function clientSecret(): string {
  return config.socialOAuth.tiktok.clientSecret;
}

export function isTikTokOAuthConfigured(): boolean {
  return Boolean(clientKey() && clientSecret());
}

export function getTikTokAuthUrl(state: string, redirectUri: string): string {
  if (!isTikTokOAuthConfigured()) {
    throw new Error('TikTok OAuth is not configured on this server');
  }
  const params = new URLSearchParams({
    client_key: clientKey(),
    response_type: 'code',
    scope: TIKTOK_OAUTH_SCOPES.join(','),
    redirect_uri: redirectUri,
    state,
  });
  return `${TIKTOK_AUTH_URL}?${params.toString()}`;
}

export async function exchangeTikTokCode(code: string, redirectUri: string): Promise<TikTokTokens> {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey(),
      client_secret: clientSecret(),
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!response.ok) {
    throw new Error(`TikTok OAuth code exchange failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    open_id?: string;
  };
  if (!body.access_token || !body.open_id) {
    throw new Error('TikTok OAuth response incomplete');
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? '',
    expiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000).toISOString(),
    openId: body.open_id,
  };
}

export async function refreshTikTokToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}> {
  const response = await fetch(TIKTOK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey(),
      client_secret: clientSecret(),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!response.ok) {
    throw new Error(`TikTok token refresh failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error('TikTok refresh did not return access_token');
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000).toISOString(),
  };
}
