import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Channel-consistent execution notes and confirmation-button binding stub.
 * Free-text "yes" must bind to a pending approval digest, not act alone.
 */

export type AivaChannelSurface = 'web' | 'telegram' | 'whatsapp' | 'email' | 'api' | string;

export interface ConfirmationButtonBinding {
  approvalId: string;
  digest: string;
  channel: AivaChannelSurface;
  label: string;
  expiresAt: string;
  cancelled: boolean;
  used: boolean;
}

const bindings = new Map<string, ConfirmationButtonBinding>();

export function resetPropreneurConfirmationBindings(): void {
  bindings.clear();
}

export function computeApprovalIdDigest(approvalId: string, canonicalPayload: unknown): string {
  const body =
    typeof canonicalPayload === 'string'
      ? canonicalPayload
      : JSON.stringify(canonicalPayload, Object.keys(canonicalPayload as object).sort());
  return createHash('sha256')
    .update(`${approvalId.trim()}\n${body}`)
    .digest('hex')
    .slice(0, 32);
}

/** Stub: register a channel confirmation button bound to an approval digest. */
export function bindConfirmationButton(input: {
  approvalId: string;
  canonicalPayload: unknown;
  channel: AivaChannelSurface;
  label?: string;
  ttlSeconds?: number;
}): ConfirmationButtonBinding {
  const digest = computeApprovalIdDigest(input.approvalId, input.canonicalPayload);
  const ttl = Math.max(60, input.ttlSeconds ?? 900);
  const binding: ConfirmationButtonBinding = {
    approvalId: input.approvalId.trim(),
    digest,
    channel: input.channel,
    label: input.label ?? 'Confirm',
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
    cancelled: false,
    used: false,
  };
  bindings.set(digest, binding);
  return binding;
}

export function resolveConfirmationByDigest(digest: string): ConfirmationButtonBinding | null {
  return bindings.get(digest) ?? null;
}

export function consumeConfirmationDigest(
  digest: string,
  channel: AivaChannelSurface,
): { ok: true; binding: ConfirmationButtonBinding } | { ok: false; reason: string } {
  const binding = bindings.get(digest);
  if (!binding) return { ok: false, reason: 'unknown_digest' };
  if (binding.cancelled) return { ok: false, reason: 'cancelled' };
  if (binding.used) return { ok: false, reason: 'already_used' };
  if (Date.parse(binding.expiresAt) < Date.now()) return { ok: false, reason: 'expired' };
  if (binding.channel !== channel) {
    return { ok: false, reason: 'channel_mismatch' };
  }
  binding.used = true;
  bindings.set(digest, binding);
  return { ok: true, binding };
}

export function channelExecutionNotes(): string {
  return [
    'Channel execution is identity-scoped: web, Telegram, and other channels share scopes, approvals, and audit.',
    'Confirmation buttons must include an approval id digest. Free-text yes alone never authorizes a mutation.',
    'Idempotency keys and approval digests are channel-agnostic; do not re-approve the same digest twice.',
  ].join(' ');
}

export function loadPropreneurCapabilityGuidance(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const mdPath = path.join(
    here,
    '..',
    '..',
    'docs',
    'integrations',
    'propreneur-aiva-capability-guidance.md',
  );
  try {
    return fs.readFileSync(mdPath, 'utf8');
  } catch {
    return channelExecutionNotes();
  }
}

/** System-note block for Aiva sessions with Propreneur tools. */
export function buildPropreneurCapabilitySystemNote(): string {
  const guidance = loadPropreneurCapabilityGuidance().trim();
  return `\n\n[Propreneur capability guidance]\n${guidance}\n\n[Channel execution]\n${channelExecutionNotes()}\n`;
}
