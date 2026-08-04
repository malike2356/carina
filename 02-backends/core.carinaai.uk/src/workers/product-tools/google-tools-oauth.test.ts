import { describe, expect, it } from 'vitest';
import {
  resolveDefaultGoogleToolsOAuthRedirectUri,
  isAllowedGoogleToolsOAuthRedirectUri,
  resolveGoogleToolsOAuthRedirectUri,
} from './google-tools-oauth-redirect.js';
import {
  signGoogleToolsOAuthState,
  verifyGoogleToolsOAuthState,
} from './google-tools-oauth-state.js';

describe('google-tools-oauth-redirect', () => {
  it('defaults to app callback path', () => {
    const uri = resolveDefaultGoogleToolsOAuthRedirectUri();
    expect(uri).toContain('/api/aiva/tools/oauth/google/callback');
  });

  it('accepts allowed app origin callback', () => {
    const uri = 'https://app.carinaai.uk/api/aiva/tools/oauth/google/callback';
    expect(isAllowedGoogleToolsOAuthRedirectUri(uri)).toBe(true);
    expect(resolveGoogleToolsOAuthRedirectUri(uri)).toBe(uri);
  });

  it('accepts admin.hireaiva tools callback', () => {
    const uri = 'https://admin.hireaiva.co.uk/api/aiva/tools/oauth/google/callback';
    expect(isAllowedGoogleToolsOAuthRedirectUri(uri)).toBe(true);
    expect(resolveGoogleToolsOAuthRedirectUri(uri)).toBe(uri);
  });

  it('rejects wrong path', () => {
    expect(
      isAllowedGoogleToolsOAuthRedirectUri('https://app.carinaai.uk/api/aiva/email/oauth/gmail/callback'),
    ).toBe(false);
  });
});

describe('google-tools-oauth-state', () => {
  it('round-trips signed state', () => {
    process.env.CHANNEL_CREDENTIAL_KEY = process.env.CHANNEL_CREDENTIAL_KEY || 'test-secret-for-oauth-state';
    const state = signGoogleToolsOAuthState({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      workerId: '22222222-2222-4222-8222-222222222222',
      toolSlug: 'google-drive',
      redirectUri: 'https://app.carinaai.uk/api/aiva/tools/oauth/google/callback',
      returnPath: '/aiva/workers/22222222-2222-4222-8222-222222222222?tab=channels',
    });
    const parsed = verifyGoogleToolsOAuthState(state);
    expect(parsed?.toolSlug).toBe('google-drive');
    expect(parsed?.workerId).toBe('22222222-2222-4222-8222-222222222222');
  });
});
