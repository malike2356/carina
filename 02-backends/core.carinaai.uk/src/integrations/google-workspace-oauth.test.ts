import { describe, expect, it } from 'vitest';
import {
  buildGoogleWorkspaceAuthUrl,
  DRIVE_FILE_SCOPE,
  DRIVE_FULL_SCOPE,
  GOOGLE_WORKSPACE_SCOPES,
  resolveGoogleRedirectUri,
  scopesForDriveCapability,
} from './google-workspace-oauth.js';

describe('google-workspace-oauth', () => {
  it('builds consent URL with offline access and workspace scopes without full drive by default', () => {
    const { authUrl, redirectUri, scopes } = buildGoogleWorkspaceAuthUrl({
      clientId: 'client-123.apps.googleusercontent.com',
      redirectUri: 'http://localhost:7430/oauth/google/callback',
    });
    expect(redirectUri).toBe('http://localhost:7430/oauth/google/callback');
    expect(authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth?');
    expect(authUrl).toContain('client_id=client-123');
    expect(authUrl).toContain('access_type=offline');
    expect(authUrl).toContain('prompt=consent');
    expect(authUrl).toContain(encodeURIComponent('https://www.googleapis.com/auth/calendar'));
    expect(authUrl).toContain(encodeURIComponent('https://www.googleapis.com/auth/contacts'));
    expect(authUrl).toContain(encodeURIComponent(DRIVE_FILE_SCOPE));
    // drive.file encodes as .../auth/drive.file, so avoid substring checks on /auth/drive alone.
    expect(scopes).toContain(DRIVE_FILE_SCOPE);
    expect(scopes).not.toContain(DRIVE_FULL_SCOPE);
    expect(new URL(authUrl).searchParams.get('scope')?.split(' ')).not.toContain(DRIVE_FULL_SCOPE);
    expect(GOOGLE_WORKSPACE_SCOPES.length).toBeGreaterThan(3);
  });

  it('adds full drive only when capability requests it', () => {
    const full = scopesForDriveCapability('full');
    expect(full).toContain(DRIVE_FULL_SCOPE);
    expect(full).toContain(DRIVE_FILE_SCOPE);
    const fileOnly = scopesForDriveCapability('file');
    expect(fileOnly).not.toContain(DRIVE_FULL_SCOPE);
  });

  it('resolves redirect uri from env fallback', () => {
    const prev = process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    process.env.GOOGLE_WORKSPACE_REDIRECT_URI = 'https://app.example/oauth/cb';
    expect(resolveGoogleRedirectUri()).toBe('https://app.example/oauth/cb');
    if (prev === undefined) delete process.env.GOOGLE_WORKSPACE_REDIRECT_URI;
    else process.env.GOOGLE_WORKSPACE_REDIRECT_URI = prev;
  });
});
