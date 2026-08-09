/**
 * Google Workspace OAuth helpers for conversational configure.
 * Persists GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN.
 *
 * Drive scopes (prompt 711): default includes drive.file only. Full drive is
 * requested only via buildGoogleWorkspaceAuthUrl({ scopes }) or
 * scopesForDriveCapability('full').
 */

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FULL_SCOPE = 'https://www.googleapis.com/auth/drive';

/** Base Workspace scopes without privileged full-Drive access. */
export const GOOGLE_WORKSPACE_BASE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/contacts',
  DRIVE_FILE_SCOPE,
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/tasks',
] as const;

/** @deprecated Prefer GOOGLE_WORKSPACE_BASE_SCOPES; kept as alias without full drive. */
export const GOOGLE_WORKSPACE_SCOPES = GOOGLE_WORKSPACE_BASE_SCOPES;

export function scopesForDriveCapability(capability: 'file' | 'full'): string[] {
  return capability === 'full'
    ? [...GOOGLE_WORKSPACE_BASE_SCOPES, DRIVE_FULL_SCOPE]
    : [...GOOGLE_WORKSPACE_BASE_SCOPES];
}

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
  /** Override scopes (incremental auth). Defaults to base scopes with drive.file only. */
  scopes?: readonly string[];
  includeGrantedScopes?: boolean;
}): { authUrl: string; redirectUri: string; scopes: string[] } {
  const redirectUri = resolveGoogleRedirectUri(opts.redirectUri);
  const scopes = [...(opts.scopes ?? GOOGLE_WORKSPACE_BASE_SCOPES)];
  const params = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes.join(' '),
    state: opts.state ?? 'carina-gws',
  });
  if (opts.includeGrantedScopes !== false) {
    params.set('include_granted_scopes', 'true');
  }
  return {
    authUrl: `${GOOGLE_AUTH_URL}?${params.toString()}`,
    redirectUri,
    scopes,
  };
}

export type GoogleWorkspaceTokenExchange = {
  accessToken: string;
  refreshToken: string;
  expiryDate: number;
  email: string;
  scope?: string;
};

export type GoogleWorkspaceTokenRefresh = {
  accessToken: string;
  expiryDate: number;
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

export async function refreshGoogleWorkspaceAccessToken(opts: {
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<GoogleWorkspaceTokenRefresh> {
  const clientId =
    opts.clientId?.trim()
    || process.env.GOOGLE_CLIENT_ID?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    || '';
  const clientSecret =
    opts.clientSecret?.trim()
    || process.env.GOOGLE_CLIENT_SECRET?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    || '';
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth client credentials are not configured');
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
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
  if (!tokens.access_token) {
    throw new Error('No access_token returned by Google OAuth refresh');
  }
  return {
    accessToken: tokens.access_token,
    expiryDate: Date.now() + Math.max(0, tokens.expires_in ?? 0) * 1000,
    scope: tokens.scope,
  };
}
