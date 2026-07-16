import { describe, expect, it } from 'vitest';
import {
  buildGoogleWorkspaceAuthUrl,
  GOOGLE_WORKSPACE_SCOPES,
  resolveGoogleRedirectUri,
} from './google-workspace-oauth.js';

describe('google-workspace-oauth', () => {
  it('builds consent URL with offline access and workspace scopes', () => {
    const { authUrl, redirectUri } = buildGoogleWorkspaceAuthUrl({
      clientId: 'client-123.apps.googleusercontent.com',
      redirectUri: 'http://localhost:7430/oauth/google/callback',
    });
    expect(redirectUri).toBe('http://localhost:7430/oauth/google/callback');
    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(authUrl).toContain('client_id=client-123');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('prompt=consent');
    expect(authUrl).toContain(encodeURIComponent('https://www.googleapis.com/auth/calendar'));
    expect(GOOGLE_WORKSPACE_SCOPES.length).toBeGreaterThan(3);
  });

  it('resolves redirect uri from env fallback', () => {
    const prev = process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    process.env.GOOGLE_WORKSPACE_REDIRECT_URI = 'https://app.example/oauth/cb';
    expect(resolveGoogleRedirectUri()).toBe('https://app.example/oauth/cb');
    if (prev === undefined) delete process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    else process.env.GOOGLE_WORKSPACE_REDIRECT_URI = prev;
  });
});
