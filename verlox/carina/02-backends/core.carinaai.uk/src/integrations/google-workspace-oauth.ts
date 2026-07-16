/**
 * Google Workspace OAuth helpers for conversational configure.
 * Persists GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const GOOGLE_WORKSPACE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  // drive.file covers app-created files; full drive needed for Workspace Ops folder sync
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/spreadsheets',
] as const;

export function resolveGoogleRedirectUri(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  return (
    process.env.GOOGLE_WORKSPACE_REDIRECT_URI?.trim() ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
    'http://localhost:7430/oauth/google/callback'
  );
}

export function buildGoogleWorkspaceAuthUrl(opts: {
  clientId: string;
  redirectUri?: string;
  state?: string;
}): { authUrl: string; redirectUri: string } {
  const redirectUri = resolveGoogleRedirectUri(opts.redirectUri);
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_WORKSPACE_SCOPES.join(' '),
    state: opts.state ?? 'carina-gws',
  });
  return {
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    redirectUri,
  };
}

export type GoogleWorkspaceTokenExchange = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
  scope?: string;
};

export async function exchangeGoogleWorkspaceCode(opts: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri?: string;
}): Promise<GoogleWorkspaceTokenExchange> {
  const redirectUri = resolveGoogleRedirectUri(opts.redirectUri);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: opts.code,
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: redirectUri,
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
  if (!tokens.access_token) {
    throw new Error('No access_token returned by Google OAuth');
  }
  if (!tokens.refresh_token) {
    throw new Error(
      'No refresh_token returned. Revoke Carina access at https://myaccount.google.com/permissions then try again with prompt=consent.',
    );
  }

  let email = '';
  try {
    const userinfo = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(8000),
    });
    if (userinfo.ok) {
      const profile = (await userinfo.json()) as { email?: string };
      email = profile.email?.trim().toLowerCase() ?? '';
    }
  } catch {
    // email is nice-to-have
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    email,
    scope: tokens.scope,
  };
}
