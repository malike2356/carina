import { afterEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('linkedin-oauth', () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('auth URL contains client_id and scopes', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'linkedin-test-client');
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'linkedin-test-secret');
    const { getLinkedInAuthUrl } = await import('./linkedin-oauth.js');
    const url = new URL(getLinkedInAuthUrl('signed-state', 'https://app.carinaai.uk/callback'));
    expect(url.searchParams.get('client_id')).toBe('linkedin-test-client');
    expect(url.searchParams.get('state')).toBe('signed-state');
    expect(url.searchParams.get('scope')).toContain('w_member_social');
  });

  it('callback exchange stores member id and tokens', async () => {
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'linkedin-test-client');
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'linkedin-test-secret');
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'access-abc',
          refresh_token: 'refresh-xyz',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sub: 'member-42' }),
      });
    const { exchangeLinkedInCode } = await import('./linkedin-oauth.js');
    const tokens = await exchangeLinkedInCode('auth-code', 'https://app.carinaai.uk/callback');
    expect(tokens.accessToken).toBe('access-abc');
    expect(tokens.refreshToken).toBe('refresh-xyz');
    expect(tokens.memberId).toBe('member-42');
    expect(tokens.expiresAt).toBeTruthy();
  });
});
