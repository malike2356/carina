import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('meta-oauth', () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('auth URL contains Meta app id', async () => {
    vi.stubEnv('META_APP_ID', 'meta-app-123');
    vi.stubEnv('META_APP_SECRET', 'meta-secret');
    const { getMetaAuthUrl } = await import('./meta-oauth.js');
    const url = new URL(getMetaAuthUrl('signed-state', 'https://app.carinaai.uk/callback'));
    expect(url.searchParams.get('client_id')).toBe('meta-app-123');
    expect(url.searchParams.get('scope')).toContain('pages_messaging');
  });

  it('fetchMetaPageAccessToken returns page token from accounts fixture', async () => {
    vi.stubEnv('META_APP_ID', 'meta-app-123');
    vi.stubEnv('META_APP_SECRET', 'meta-secret');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            id: 'page-1',
            name: 'Test Page',
            access_token: 'page-token-abc',
            instagram_business_account: { id: 'ig-99' },
          },
        ],
      }),
    });
    const { fetchMetaPageAccessToken } = await import('./meta-oauth.js');
    const result = await fetchMetaPageAccessToken('user-token', 'page-1');
    expect(result.pageAccessToken).toBe('page-token-abc');
    expect(result.instagramBusinessAccountId).toBe('ig-99');
  });
});
