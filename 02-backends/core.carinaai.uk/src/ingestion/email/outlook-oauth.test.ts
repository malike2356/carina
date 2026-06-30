import { afterEach, describe, expect, it, vi } from 'vitest';

const previousClientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
const previousClientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
const previousTenantId = process.env.MICROSOFT_OAUTH_TENANT_ID;
const previousRedirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;

describe('outlook-oauth', () => {
  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('getOutlookAuthUrl returns a Microsoft URL with code flow and offline access', async () => {
    setMicrosoftEnv();
    const { getOutlookAuthUrl } = await import('./outlook-oauth.js');

    const url = getOutlookAuthUrl('state-1');

    expect(url).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url).toContain('response_type=code');
    expect(decodeURIComponent(url)).toContain('offline_access');
  });

  it('decodeEmailFromIdToken extracts preferred_username', async () => {
    const { decodeEmailFromIdToken } = await import('./outlook-oauth.js');
    const idToken = buildIdToken({ preferred_username: 'User@Example.com' });

    expect(decodeEmailFromIdToken(idToken)).toBe('user@example.com');
  });

  it('exchangeOutlookCodeForTokens throws if no refresh_token is returned', async () => {
    setMicrosoftEnv();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      access_token: 'access-token',
      expires_in: 3600,
      id_token: buildIdToken({ preferred_username: 'user@example.com' }),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const { exchangeOutlookCodeForTokens } = await import('./outlook-oauth.js');

    await expect(exchangeOutlookCodeForTokens('code-1')).rejects.toThrow(/No refresh_token/);
  });

  it('refreshOutlookAccessToken calls the token endpoint and returns the access token', async () => {
    setMicrosoftEnv();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      access_token: 'new-access-token',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { refreshOutlookAccessToken } = await import('./outlook-oauth.js');

    await expect(refreshOutlookAccessToken('refresh-token')).resolves.toBe('new-access-token');
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('https://login.microsoftonline.com/common/oauth2/v2.0/token');
    expect(String((init as RequestInit).body)).toContain('grant_type=refresh_token');
  });
});

function setMicrosoftEnv(): void {
  process.env.MICROSOFT_OAUTH_CLIENT_ID = 'client-id';
  process.env.MICROSOFT_OAUTH_CLIENT_SECRET = 'client-secret';
  process.env.MICROSOFT_OAUTH_TENANT_ID = 'common';
  process.env.MICROSOFT_OAUTH_REDIRECT_URI = 'https://core.carinaai.uk/api/aiva/email/oauth/outlook/callback';
  vi.resetModules();
}

function restoreEnv(): void {
  setOrDelete('MICROSOFT_OAUTH_CLIENT_ID', previousClientId);
  setOrDelete('MICROSOFT_OAUTH_CLIENT_SECRET', previousClientSecret);
  setOrDelete('MICROSOFT_OAUTH_TENANT_ID', previousTenantId);
  setOrDelete('MICROSOFT_OAUTH_REDIRECT_URI', previousRedirectUri);
}

function setOrDelete(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function buildIdToken(payload: Record<string, unknown>): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `header.${encoded}.signature`;
}
