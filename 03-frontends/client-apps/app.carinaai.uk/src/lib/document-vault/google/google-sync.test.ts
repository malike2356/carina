import { describe, expect, it } from 'vitest';
import {
  consentCopyForMode,
  modeRequiresFullDrive,
  scopesForVaultDriveMode,
  SHARED_DRIVES_ENABLED,
  validateVaultDriveMode,
  DRIVE_FILE_SCOPE,
  DRIVE_FULL_SCOPE,
} from '@/lib/document-vault/google/scopes';
import {
  hashWatchToken,
  newWatchVerificationToken,
  redactSecrets,
  verifyWatchToken,
} from '@/lib/document-vault/google/verification-token';
import { shouldRenewWatch, webhookPublicUrl } from '@/lib/document-vault/google/watch-helpers';
import {
  signVaultGoogleOAuthState,
  verifyVaultGoogleOAuthState,
} from '@/lib/document-vault/google/oauth-state';

describe('vault google scopes (711)', () => {
  it('prefers drive.file for outbound and full drive for inbound/two-way', () => {
    expect(scopesForVaultDriveMode('outbound_only')).toContain(DRIVE_FILE_SCOPE);
    expect(scopesForVaultDriveMode('outbound_only')).not.toContain(DRIVE_FULL_SCOPE);
    expect(scopesForVaultDriveMode('inbound_only')).toContain(DRIVE_FULL_SCOPE);
    expect(scopesForVaultDriveMode('two_way')).toContain(DRIVE_FULL_SCOPE);
    expect(modeRequiresFullDrive('outbound_only')).toBe(false);
    expect(modeRequiresFullDrive('two_way')).toBe(true);
    expect(validateVaultDriveMode('two_way')).toBe('two_way');
    expect(() => validateVaultDriveMode('nope')).toThrow(/unsupported/);
    expect(consentCopyForMode('two_way')).toMatch(/privileged/i);
    expect(SHARED_DRIVES_ENABLED).toBe(false);
  });
});

describe('vault google watch tokens (711)', () => {
  it('stores digest only and verifies opaque channel tokens', () => {
    const { plaintext, digest } = newWatchVerificationToken();
    expect(digest).toBe(hashWatchToken(plaintext));
    expect(digest).not.toContain(plaintext);
    expect(verifyWatchToken(plaintext, digest)).toBe(true);
    expect(verifyWatchToken('wrong', digest)).toBe(false);
    expect(verifyWatchToken(plaintext, '0'.repeat(digest.length))).toBe(false);
  });

  it('redacts secrets from public payloads', () => {
    const redacted = redactSecrets({
      access_token: 'ya29.secret',
      nested: { refresh_token: '1/abc', ok: 'safe' },
    }) as Record<string, unknown>;
    expect(redacted.access_token).toBe('[redacted]');
    expect((redacted.nested as Record<string, unknown>).refresh_token).toBe('[redacted]');
    expect((redacted.nested as Record<string, unknown>).ok).toBe('safe');
  });

  it('renews when within overlap window', () => {
    const now = new Date('2026-08-09T12:00:00Z');
    expect(
      shouldRenewWatch({
        channelExpiresAt: '2026-08-09T13:00:00Z',
        now,
        overlapHours: 2,
      }),
    ).toBe(true);
    expect(
      shouldRenewWatch({
        channelExpiresAt: '2026-08-10T12:00:00Z',
        now,
        overlapHours: 2,
      }),
    ).toBe(false);
    expect(shouldRenewWatch({ channelExpiresAt: null })).toBe(true);
  });

  it('builds https webhook URL without embedding secrets', () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://admin.hireaiva.co.uk';
    expect(webhookPublicUrl()).toBe('https://admin.hireaiva.co.uk/api/vault/google/webhook');
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe('vault google oauth state (711)', () => {
  it('round-trips signed state without tokens', () => {
    const state = signVaultGoogleOAuthState({
      workspaceId: 'ws-1',
      mode: 'outbound_only',
      ts: 1,
    });
    const parsed = verifyVaultGoogleOAuthState(state);
    expect(parsed?.workspaceId).toBe('ws-1');
    expect(verifyVaultGoogleOAuthState(state.slice(0, -2) + 'aa')).toBeNull();
  });
});
