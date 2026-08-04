import { describe, expect, it } from 'vitest';
import {
  isAllowedEmailOAuthRedirectUri,
  resolveDefaultEmailOAuthRedirectUri,
} from './email-oauth-redirect.js';

describe('email-oauth-redirect', () => {
  it('allows configured app origins for gmail callback', () => {
    process.env.AIVA_APP_URL = 'https://admin.hireaiva.co.uk';
    process.env.AIVA_EMAIL_OAUTH_REDIRECT_ORIGINS = 'https://app.carinaai.uk';
    expect(
      isAllowedEmailOAuthRedirectUri(
        'https://admin.hireaiva.co.uk/api/aiva/email/oauth/gmail/callback',
        'gmail',
      ),
    ).toBe(true);
    expect(
      isAllowedEmailOAuthRedirectUri(
        'https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback',
        'gmail',
      ),
    ).toBe(true);
    expect(
      isAllowedEmailOAuthRedirectUri(
        'https://evil.example/api/aiva/email/oauth/gmail/callback',
        'gmail',
      ),
    ).toBe(false);
  });

  it('builds default redirect from AIVA_APP_URL', () => {
    process.env.AIVA_APP_URL = 'https://admin.hireaiva.co.uk';
    expect(resolveDefaultEmailOAuthRedirectUri('gmail')).toBe(
      'https://admin.hireaiva.co.uk/api/aiva/email/oauth/gmail/callback',
    );
  });
});
