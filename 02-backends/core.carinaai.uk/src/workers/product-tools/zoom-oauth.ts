/**
 * Zoom OAuth connection helpers for concierge setup (Prompt 698)
 * and meeting adapter token refresh (Prompt 703).
 */

function zoomClientId(): string {
  return process.env.ZOOM_CLIENT_ID?.trim() || process.env.ZOOM_OAUTH_CLIENT_ID?.trim() || '';
}

function zoomClientSecret(): string {
  return process.env.ZOOM_CLIENT_SECRET?.trim() || process.env.ZOOM_OAUTH_CLIENT_SECRET?.trim() || '';
}

export function isZoomOAuthConfigured(): boolean {
  return Boolean(zoomClientId() && zoomClientSecret());
}

export function zoomWebhookSecret(): string {
  return process.env.ZOOM_WEBHOOK_SECRET_TOKEN?.trim() || process.env.ZOOM_WEBHOOK_SECRET?.trim() || '';
}

export function resolveZoomRedirectUri(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  const fromEnv = process.env.ZOOM_OAUTH_REDIRECT_URI?.trim();
  if (fromEnv) return fromEnv;
  const appBase =
    process.env.AIVA_APP_URL?.trim()
    || process.env.NEXT_PUBLIC_APP_URL?.trim()
    || 'https://app.carinaai.uk';
  return `${appBase.replace(/\/$/, '')}/api/aiva/tools/oauth/zoom/callback`;
}

export function buildZoomAuthUrl(opts: {
  state: string;
  redirectUri: string;
}): { authUrl: string; redirectUri: string } {
  if (!isZoomOAuthConfigured()) {
    throw new Error('Zoom OAuth is not configured on this server');
  }
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: zoomClientId(),
    redirect_uri: opts.redirectUri,
    state: opts.state,
  });
  return {
    authUrl: `https://zoom.us/oauth/authorize?${params.toString()}`,
    redirectUri: opts.redirectUri,
  };
}

export async function exchangeZoomCode(opts: {
  code: string;
  redirectUri: string;
}): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  if (!isZoomOAuthConfigured()) {
    throw new Error('Zoom OAuth is not configured on this server');
  }
  const basic = Buffer.from(`${zoomClientId()}:${zoomClientSecret()}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: opts.code,
    redirect_uri: opts.redirectUri,
  });
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    reason?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.reason || data.error || `Zoom token exchange failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshZoomAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  if (!isZoomOAuthConfigured()) {
    throw new Error('Zoom OAuth is not configured on this server');
  }
  const basic = Buffer.from(`${zoomClientId()}:${zoomClientSecret()}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  });
  const res = await fetch('https://zoom.us/oauth/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    reason?: string;
  };
  if (!res.ok || !data.access_token) {
    throw new Error(data.reason || data.error || `Zoom token refresh failed (${res.status})`);
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function fetchZoomAccountIdentity(accessToken: string): Promise<{
  accountId?: string;
  email?: string;
  displayName?: string;
  status: 'ok' | 'expired' | 'error';
  error?: string;
}> {
  const res = await fetch('https://api.zoom.us/v2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 401) {
    return { status: 'expired', error: 'Zoom token expired or revoked' };
  }
  if (!res.ok) {
    return { status: 'error', error: `Zoom user lookup failed (${res.status})` };
  }
  const data = (await res.json()) as {
    id?: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    display_name?: string;
  };
  const displayName =
    data.display_name
    || [data.first_name, data.last_name].filter(Boolean).join(' ').trim()
    || undefined;
  return {
    status: 'ok',
    accountId: data.id,
    email: data.email,
    displayName,
  };
}

export async function revokeZoomToken(token: string): Promise<void> {
  if (!isZoomOAuthConfigured()) return;
  const basic = Buffer.from(`${zoomClientId()}:${zoomClientSecret()}`).toString('base64');
  const body = new URLSearchParams({ token });
  await fetch('https://zoom.us/oauth/revoke', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  }).catch(() => undefined);
}
