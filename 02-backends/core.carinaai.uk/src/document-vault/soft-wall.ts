/**
 * Soft Wall gates for Document Vault high-impact actions (prompt 712).
 */

import { createHash } from 'node:crypto';
import { VaultError } from './service.js';

export const DOCUMENT_VAULT_GATES = new Set([
  'document_vault.permanent_delete',
  'document_vault.external_share',
  'document_vault.permission_change',
  'document_vault.bulk_destructive',
  'document_vault.conflict_overwrite',
  'document_vault.classified_export',
]);

const ALWAYS_GATED = new Set([
  'document_vault.permanent_delete',
  'document_vault.classified_export',
  'document_vault.conflict_overwrite',
]);

export type SoftWallResult =
  | { allowed: true; blocked: false }
  | {
      allowed: false;
      blocked: true;
      kind: string;
      subject: string;
      approvalRequired: true;
      digest: string;
      deepLink: string;
    };

export function softWallEnabled(): boolean {
  const raw = (process.env.CARINA_DOCUMENT_VAULT_SOFT_WALL ?? '1').trim().toLowerCase();
  return !['0', 'false', 'no', 'off'].includes(raw);
}

export function payloadDigest(payload: Record<string, unknown>): string {
  const stable = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash('sha256').update(stable).digest('hex');
}

export function redactAuditPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const banned = new Set([
    'access_token',
    'refresh_token',
    'content',
    'bytes',
    'file_bytes',
    'Authorization',
    'grant_ciphertext',
    'encryptedGrant',
    'approvalToken',
    'token',
  ]);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (banned.has(key) || /token|secret|password/i.test(key)) {
      out[key] = '[redacted]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      out[key] = redactAuditPayload(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function gateVaultAction(input: {
  kind: string;
  subject: string;
  payload: Record<string, unknown>;
  approvalToken?: string | null;
  /** When true, caller already consumed a valid approval token. */
  approved?: boolean;
}): SoftWallResult {
  if (!DOCUMENT_VAULT_GATES.has(input.kind)) {
    return { allowed: true, blocked: false };
  }
  if (input.approved || (input.approvalToken && input.approvalToken.trim())) {
    return { allowed: true, blocked: false };
  }
  if (!softWallEnabled() && !ALWAYS_GATED.has(input.kind)) {
    return { allowed: true, blocked: false };
  }
  const digest = payloadDigest(input.payload);
  return {
    allowed: false,
    blocked: true,
    kind: input.kind,
    subject: input.subject,
    approvalRequired: true,
    digest,
    deepLink: `/documents?approvalGate=${encodeURIComponent(input.kind)}`,
  };
}

export function assertVaultGateAllowed(result: SoftWallResult): void {
  if (result.allowed) return;
  throw new VaultError(
    `Approval required for ${result.kind}: ${result.subject}. Open ${result.deepLink}`,
    'approval_required',
  );
}
