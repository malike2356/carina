import { config } from '../../config/index.js';

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_SCOPES = ['openid', 'profile', 'w_member_social'];

export interface LinkedInTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  memberId: string;
}

function clientId(): string {
  return config.socialOAuth.linkedin.clientId;
}

function clientSecret(): string {
  return config.socialOAuth.linkedin.clientSecret;
}

export function isLinkedInOAuthConfigured(): boolean {
  return Boolean(clientId() && clientSecret());
}

export function getLinkedInAuthUrl(state: string, redirectUri: string): string {
  if (!isLinkedInOAuthConfigured()) {
    throw new Error('LinkedIn OAuth is not configured on this server');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri,
    state,
    scope: LINKEDIN_SCOPES.join(' '),
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string,
): Promise<LinkedInTokens> {
  if (!isLinkedInOAuthConfigured()) {
    throw new Error('LinkedIn OAuth is not configured on this server');
  }
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn OAuth code exchange failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error('LinkedIn OAuth did not return access_token');
  }

  const profileResponse = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${body.access_token}` },
  });
  if (!profileResponse.ok) {
    throw new Error(`LinkedIn userinfo failed with HTTP ${profileResponse.status}`);
  }
  const profile = await profileResponse.json() as { sub?: string };
  const memberId = profile.sub?.trim() ?? '';
  if (!memberId) {
    throw new Error('LinkedIn OAuth did not return member id');
  }

  const expiresAt = new Date(
    Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000,
  ).toISOString();

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? '',
    expiresAt,
    memberId,
  };
}

export async function refreshLinkedInToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}> {
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId(),
      client_secret: clientSecret(),
    }),
  });
  if (!response.ok) {
    throw new Error(`LinkedIn token refresh failed with HTTP ${response.status}`);
  }
  const body = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (!body.access_token) {
    throw new Error('LinkedIn refresh did not return access_token');
  }
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? refreshToken,
    expiresAt: new Date(Date.now() + Math.max(0, body.expires_in ?? 3600) * 1000).toISOString(),
  };
}
