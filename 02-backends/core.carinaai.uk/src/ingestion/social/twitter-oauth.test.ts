import crypto from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTwitterCrcResponse } from '../../gateway/channels/adapters/twitter-oauth.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('twitter-oauth', () => {
  afterEach(() => {
    mockFetch.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('CRC response matches gateway test vectors', () => {
    const crcToken = 'challenge_token_abc';
    const consumerSecret = 'consumer-secret';
    const response = buildTwitterCrcResponse(crcToken, consumerSecret);
    const expected = `sha256=${crypto
      .createHmac('sha256', consumerSecret)
      .update(crcToken)
      .digest('base64')}`;
    expect(response).toEqual({ response_token: expected });
  });

  it('request token exchange returns authorize URL', async () => {
    vi.stubEnv('TWITTER_API_KEY', 'api-key');
    vi.stubEnv('TWITTER_API_SECRET', 'api-secret');
    mockFetch.mockResolvedValue({
      ok: true,
      text: async () => 'oauth_token=req-token&oauth_token_secret=req-secret',
    });
    const { getTwitterRequestToken } = await import('./twitter-oauth.js');
    const result = await getTwitterRequestToken('https://app.carinaai.uk/callback');
    expect(result.oauthToken).toBe('req-token');
    expect(result.oauthTokenSecret).toBe('req-secret');
    expect(result.authUrl).toContain('oauth_token=req-token');
  });
});
