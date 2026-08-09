/**
 * Minimal Google token refresh for Document Vault (avoids importing core packages).
 */

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export async function refreshGoogleWorkspaceAccessToken(opts: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{ accessToken: string; expiryDate: number; scope?: string }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`Google OAuth refresh failed with HTTP ${response.status}${raw ? `: ${raw.slice(0, 200)}` : ''}`);
  }
  const tokens = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    scope?: string;
  };
  if (!tokens.access_token) throw new Error('No access_token returned by Google OAuth refresh');
  return {
    accessToken: tokens.access_token,
    expiryDate: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    scope: tokens.scope,
  };
}

export async function exchangeGoogleWorkspaceCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
  scope?: string;
}> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(`Google OAuth code exchange failed with HTTP ${response.status}`);
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
      'No refresh_token returned. Revoke Aiva access at https://myaccount.google.com/permissions then reconnect with consent.',
    );
  }

  let email = '';
  try {
    const userinfo = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (userinfo.ok) {
      const profile = (await userinfo.json()) as { email?: string };
      email = profile.email?.trim().toLowerCase() ?? '';
    }
  } catch {
    /* optional */
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    email,
    scope: tokens.scope,
  };
}

export function buildGoogleAuthUrl(opts: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: opts.scopes.join(' '),
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
