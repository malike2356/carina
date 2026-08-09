/**
 * Outreach test-mode + recipient allowlist.
 * When enabled, Soft Wall sends are blocked unless the recipient is allowlisted.
 */

export function isOutreachTestModeEnabled(workspaceId?: string): boolean {
  const raw = (process.env.CARINA_OUTREACH_TEST_MODE || '').trim().toLowerCase();
  if (raw === 'true' || raw === '1' || raw === 'on') return true;
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  const workspaces = (process.env.CARINA_OUTREACH_TEST_MODE_WORKSPACES || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (workspaceId && workspaces.includes(workspaceId)) return true;
  // Smoke harness always treats dedicated smoke workspaces as test mode.
  if (workspaceId && workspaceId.startsWith('ws-outreach-smoke')) return true;
  return false;
}

export function outreachRecipientAllowlist(): string[] {
  return (process.env.CARINA_OUTREACH_SMOKE_ALLOWLIST || process.env.CARINA_OUTREACH_RECIPIENT_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeRecipientEmail(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim();
}

export function isRecipientAllowlisted(recipient: string): boolean {
  const allow = outreachRecipientAllowlist();
  if (allow.length === 0) return false;
  const email = normalizeRecipientEmail(recipient);
  return allow.some((entry) => {
    if (entry.startsWith('*@')) return email.endsWith(entry.slice(1));
    if (entry.startsWith('@')) return email.endsWith(entry);
    return email === entry;
  });
}

export function assertRecipientAllowedForSend(input: {
  workspaceId: string;
  recipient: string;
  force?: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (input.force) return { ok: true };
  if (!isOutreachTestModeEnabled(input.workspaceId)) return { ok: true };
  const allow = outreachRecipientAllowlist();
  if (allow.length === 0) {
    return {
      ok: false,
      reason: 'test_mode_requires_allowlist',
    };
  }
  if (!isRecipientAllowlisted(input.recipient)) {
    return {
      ok: false,
      reason: 'recipient_not_allowlisted',
    };
  }
  return { ok: true };
}

export function getOutreachTestModeStatus(workspaceId?: string): {
  testMode: boolean;
  allowlistConfigured: boolean;
  allowlistCount: number;
  banner: string | null;
} {
  const testMode = isOutreachTestModeEnabled(workspaceId);
  const allowlist = outreachRecipientAllowlist();
  return {
    testMode,
    allowlistConfigured: allowlist.length > 0,
    allowlistCount: allowlist.length,
    banner: testMode
      ? 'Outreach TEST MODE is on. Sends are limited to the recipient allowlist. Do not use scraped prospects.'
      : null,
  };
}
