import { describe, expect, it, vi } from 'vitest';
import {
  isAllowedSocialOAuthRedirectUri,
  resolveDefaultSocialOAuthRedirectUri,
} from './social-oauth-redirect.js';

describe('social-oauth-redirect', () => {
  it('allows configured app origins for social callbacks', () => {
    vi.stubEnv('AIVA_APP_URL', 'https://admin.hireaiva.co.uk');
    vi.stubEnv('AIVA_SOCIAL_OAUTH_REDIRECT_ORIGINS', 'https://app.carinaai.uk');
    expect(
      isAllowedSocialOAuthRedirectUri(
        'https://admin.hireaiva.co.uk/api/aiva/social/oauth/linkedin/callback',
        'linkedin',
      ),
    ).toBe(true);
    expect(
      isAllowedSocialOAuthRedirectUri(
        'https://app.carinaai.uk/api/aiva/social/oauth/meta/callback',
        'meta',
      ),
    ).toBe(true);
    expect(
      isAllowedSocialOAuthRedirectUri(
        'https://evil.example/api/aiva/social/oauth/linkedin/callback',
        'linkedin',
      ),
    ).toBe(false);
    expect(
      isAllowedSocialOAuthRedirectUri(
        'https://app.carinaai.uk/api/aiva/social/oauth/linkedin/callback',
        'meta',
      ),
    ).toBe(false);
  });

  it('builds default redirect from AIVA_APP_URL', () => {
    vi.stubEnv('AIVA_APP_URL', 'https://admin.hireaiva.co.uk');
    expect(resolveDefaultSocialOAuthRedirectUri('twitter')).toBe(
      'https://admin.hireaiva.co.uk/api/aiva/social/oauth/twitter/callback',
    );
  });
});
