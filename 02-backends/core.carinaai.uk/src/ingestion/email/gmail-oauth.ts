import { config } from '../../config/index.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_SCOPES = [
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/userinfo.email',
];

export interface GmailTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
}

function assertConfigured(): void {
  if (!config.googleOAuth.clientId || !config.googleOAuth.clientSecret) {
    throw new Error('Gmail OAuth is not configured on this server');
  }
}

export function isGmailOAuthConfigured(): boolean {
  return Boolean(config.googleOAuth.clientId && config.googleOAuth.clientSecret);
}

export function getGmailAuthUrl(state: string, redirectUri?: string): string {
  assertConfigured();
  const resolvedRedirectUri = redirectUri?.trim() || config.googleOAuth.redirectUri;
  const params = new URLSearchParams({
    client_id: config.googleOAuth.clientId,
    redirect_uri: resolvedRedirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES.join(' '),
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri?: string): Promise<GmailTokens> {
  assertConfigured();
  const resolvedRedirectUri = redirectUri?.trim() || config.googleOAuth.redirectUri;
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.googleOAuth.clientId,
      client_secret: config.googleOAuth.clientSecret,
      redirect_uri: resolvedRedirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail OAuth code exchange failed with HTTP ${response.status}`);
  }

  const tokens = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!tokens.access_token) {
    throw new Error('No access_token returned by Gmail OAuth');
  }
  if (!tokens.refresh_token) {
    throw new Error('No refresh_token returned. User may need to revoke access and re-authorise.');
  }

  const userinfo = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfo.ok) {
    throw new Error(`Gmail OAuth userinfo lookup failed with HTTP ${userinfo.status}`);
  }

  const profile = await userinfo.json() as { email?: string };
  const email = profile.email?.trim().toLowerCase() ?? '';
  if (!email) {
    throw new Error('Could not determine Gmail address from OAuth token');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    email,
  };
}

export async function getValidAccessToken(refreshToken: string): Promise<string> {
  assertConfigured();
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.googleOAuth.clientId,
      client_secret: config.googleOAuth.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    throw new Error(`Gmail OAuth refresh failed with HTTP ${response.status}`);
  }
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) {
    throw new Error('No access_token returned by Gmail OAuth refresh');
  }
  return body.access_token;
}
