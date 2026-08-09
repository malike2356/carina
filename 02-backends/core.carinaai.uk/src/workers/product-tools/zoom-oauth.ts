/**
 * Zoom OAuth connection helpers for concierge setup (Prompt 698).
 * Meeting creation belongs to Prompt 703; this only stores tokens.
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
