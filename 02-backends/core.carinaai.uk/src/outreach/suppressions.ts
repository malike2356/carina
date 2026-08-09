/** Workspace email suppression list for outreach compliance. */

import { normalizeEmail } from './dedupe.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type { OutreachLead } from './types.js';

export type SuppressionReason =
  | 'unsubscribe'
  | 'complaint'
  | 'hard_bounce'
  | 'manual'
  | 'opted_out'
  | 'policy';

export interface SuppressionEntry {
  email: string;
  reason: SuppressionReason;
  leadId?: string;
  note?: string;
  createdAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export function listSuppressions(workspaceId: string): SuppressionEntry[] {
  return (loadOutreachStore().suppressions ?? [])
    .filter((row) => row.workspaceId === workspaceId)
    .map(({ email, reason, leadId, note, createdAt }) => ({ email, reason, leadId, note, createdAt }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function isAddressSuppressed(workspaceId: string, email?: string | null): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return (loadOutreachStore().suppressions ?? []).some(
    (row) => row.workspaceId === workspaceId && row.email === normalized,
  );
}

export function suppressAddress(input: {
  workspaceId: string;
  email: string;
  reason: SuppressionReason;
  leadId?: string;
  note?: string;
}): SuppressionEntry | null {
  const email = normalizeEmail(input.email);
  if (!email) return null;
  const stamp = nowIso();
  let entry: SuppressionEntry = {
    email,
    reason: input.reason,
    leadId: input.leadId,
    note: input.note,
    createdAt: stamp,
  };
  mutateOutreachStore((store) => {
    if (!store.suppressions) store.suppressions = [];
    const idx = store.suppressions.findIndex(
      (row) => row.workspaceId === input.workspaceId && row.email === email,
    );
    const next = {
      workspaceId: input.workspaceId,
      email,
      reason: input.reason,
      leadId: input.leadId,
      note: input.note,
      createdAt: idx >= 0 ? store.suppressions[idx]!.createdAt : stamp,
      updatedAt: stamp,
    };
    if (idx >= 0) store.suppressions[idx] = next;
    else store.suppressions.push(next);
    entry = {
      email: next.email,
      reason: next.reason,
      leadId: next.leadId,
      note: next.note,
      createdAt: next.createdAt,
    };
  });
  return entry;
}

export function suppressLead(
  lead: OutreachLead,
  reason: SuppressionReason,
  note?: string,
): SuppressionEntry | null {
  if (!lead.email) return null;
  return suppressAddress({
    workspaceId: lead.workspaceId,
    email: lead.email,
    reason,
    leadId: lead.id,
    note,
  });
}
