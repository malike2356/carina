import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('tiktok-oauth', () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('auth URL contains client_key and scopes', async () => {
    vi.stubEnv('TIKTOK_CLIENT_KEY', 'tiktok-test-key');
    vi.stubEnv('TIKTOK_CLIENT_SECRET', 'tiktok-test-secret');
    const { getTikTokAuthUrl } = await import('./tiktok-oauth.js');
    const url = new URL(getTikTokAuthUrl('signed-state', 'https://app.carinaai.uk/callback'));
    expect(url.searchParams.get('client_key')).toBe('tiktok-test-key');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toContain('user.info.basic');
  });

  it('callback exchange stores open id and tokens', async () => {
    vi.stubEnv('TIKTOK_CLIENT_KEY', 'tiktok-test-key');
    vi.stubEnv('TIKTOK_CLIENT_SECRET', 'tiktok-test-secret');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'access-abc',
        refresh_token: 'refresh-xyz',
        expires_in: 3600,
        open_id: 'open-42',
      }),
    });
    const { exchangeTikTokCode } = await import('./tiktok-oauth.js');
    const tokens = await exchangeTikTokCode('auth-code', 'https://app.carinaai.uk/callback');
    expect(tokens.accessToken).toBe('access-abc');
    expect(tokens.refreshToken).toBe('refresh-xyz');
    expect(tokens.openId).toBe('open-42');
    expect(tokens.expiresAt).toBeTruthy();
  });

  it('refresh token returns new access token', async () => {
    vi.stubEnv('TIKTOK_CLIENT_KEY', 'tiktok-test-key');
    vi.stubEnv('TIKTOK_CLIENT_SECRET', 'tiktok-test-secret');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 7200,
      }),
    });
    const { refreshTikTokToken } = await import('./tiktok-oauth.js');
    const tokens = await refreshTikTokToken('old-refresh');
    expect(tokens.accessToken).toBe('new-access');
    expect(tokens.refreshToken).toBe('new-refresh');
  });
});
