import { afterEach, describe, expect, it, vi } from 'vitest';

const previousClientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const previousClientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const previousRedirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

describe('getGmailAuthUrl', () => {
  afterEach(() => {
    restoreEnv(previousClientId, previousClientSecret, previousRedirectUri);
    vi.resetModules();
  });

  it('returns a Google URL containing offline access and Gmail scope', async () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'client-id';
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'client-secret';
    process.env.GOOGLE_OAUTH_REDIRECT_URI = 'https://core.carinaai.uk/api/aiva/email/oauth/gmail/callback';
    vi.resetModules();

    const { getGmailAuthUrl } = await import('./gmail-oauth.js');
    const url = getGmailAuthUrl('state-1');
    expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url).toContain('access_type=offline');
    expect(decodeURIComponent(url)).toContain('scope=https://mail.google.com/');
    expect(url).toContain('state=state-1');
  });
});

function restoreEnv(
  clientId: string | undefined,
  clientSecret: string | undefined,
  redirectUri: string | undefined,
): void {
  if (clientId === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  else process.env.GOOGLE_OAUTH_CLIENT_ID = clientId;
  if (clientSecret === undefined) delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  else process.env.GOOGLE_OAUTH_CLIENT_SECRET = clientSecret;
  if (redirectUri === undefined) delete process.env.GOOGLE_OAUTH_REDIRECT_URI;
  else process.env.GOOGLE_OAUTH_REDIRECT_URI = redirectUri;
}
