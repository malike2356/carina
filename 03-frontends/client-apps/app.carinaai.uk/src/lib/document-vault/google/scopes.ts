/**
 * Document Vault Google Drive scopes and sync modes (prompt 711).
 * Prefer drive.file; request full drive only for inbound/two-way with explicit consent.
 */

export type VaultDriveSyncMode = 'outbound_only' | 'inbound_only' | 'two_way';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const DRIVE_FULL_SCOPE = 'https://www.googleapis.com/auth/drive';
export const USERINFO_EMAIL_SCOPE = 'https://www.googleapis.com/auth/userinfo.email';

export const MODE_SCOPES: Record<VaultDriveSyncMode, readonly string[]> = {
  outbound_only: ['openid', USERINFO_EMAIL_SCOPE, DRIVE_FILE_SCOPE],
  inbound_only: ['openid', USERINFO_EMAIL_SCOPE, DRIVE_FULL_SCOPE],
  two_way: ['openid', USERINFO_EMAIL_SCOPE, DRIVE_FULL_SCOPE],
};

export const MODE_CONSENT: Record<VaultDriveSyncMode, string> = {
  outbound_only:
    'Outbound-only sync uses drive.file so Aiva can create and update files it owns or that you explicitly select. It cannot browse your full Drive.',
  inbound_only:
    'Inbound-only sync needs full Drive read access to follow changes under your selected root. Aiva will not push local edits to Google.',
  two_way:
    'Two-way sync needs full Drive access under your selected root so Aiva can pull Google changes and push local vault edits. This is a privileged grant.',
};

export function validateVaultDriveMode(mode: string): VaultDriveSyncMode {
  if (mode === 'outbound_only' || mode === 'inbound_only' || mode === 'two_way') return mode;
  throw new Error(`unsupported sync mode: ${mode}`);
}

export function scopesForVaultDriveMode(mode: string): string[] {
  const key = mode in MODE_SCOPES ? (mode as VaultDriveSyncMode) : 'outbound_only';
  return [...MODE_SCOPES[key]];
}

export function modeRequiresFullDrive(mode: string): boolean {
  return mode === 'inbound_only' || mode === 'two_way';
}

export function consentCopyForMode(mode: string): string {
  const key = mode in MODE_CONSENT ? (mode as VaultDriveSyncMode) : 'outbound_only';
  return MODE_CONSENT[key];
}

/** Shared Drives stay disabled until supportsAllDrives + corpora tests land. */
export const SHARED_DRIVES_ENABLED = false;
