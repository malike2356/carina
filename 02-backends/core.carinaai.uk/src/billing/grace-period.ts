/**
 * Grace period helpers for dunning (14-day buffer; full access while past_due).
 */

import {
  gracePeriodEndsAt as legacyGraceEnds,
  markSubscriptionPastDue,
  reactivateSubscription,
  suspendSubscription,
  suspendIfGraceExpired,
} from './aiva-billing.js';
import { dunningGraceDays, getActiveDunningCase } from './dunning-store.js';
import { pool } from '../memory/db.js';

export function dunningGracePeriodEndsAt(from = new Date()): Date {
  return new Date(from.getTime() + dunningGraceDays() * 86_400_000);
}

export async function enterGracePeriod(
  workspaceId: string,
  endsAt?: Date,
): Promise<{ graceEndsAt: string }> {
  const ends = endsAt ?? dunningGracePeriodEndsAt();
  await markSubscriptionPastDue(workspaceId, ends);
  return { graceEndsAt: ends.toISOString() };
}

export async function isInGracePeriod(workspaceId: string): Promise<boolean> {
  const result = await pool.query(
    `SELECT status, grace_period_ends_at FROM aiva_subscriptions WHERE workspace_id = $1`,
    [workspaceId],
  );
  const row = result.rows[0] as { status?: string; grace_period_ends_at?: string | Date } | undefined;
  if (!row || row.status !== 'past_due') {
    // Fall back to dunning case if DB row missing in tests
    const active = getActiveDunningCase(workspaceId);
    if (!active) return false;
    return Date.parse(active.graceEndsAt) > Date.now();
  }
  const ends = row.grace_period_ends_at ? new Date(String(row.grace_period_ends_at)) : null;
  return Boolean(ends && ends.getTime() > Date.now());
}

export async function exitGracePeriod(
  workspaceId: string,
  outcome: 'recovered' | 'cancelled',
): Promise<void> {
  if (outcome === 'recovered') {
    await reactivateSubscription(workspaceId);
    return;
  }
  await suspendSubscription(workspaceId, 'payment');
}

/** Feature gate: past_due inside grace remains full access (paid lane). */
export async function notifyServiceGate(workspaceId: string): Promise<{
  fullAccess: boolean;
  inGrace: boolean;
  banner: string | null;
}> {
  const inGrace = await isInGracePeriod(workspaceId);
  if (!inGrace) {
    return { fullAccess: false, inGrace: false, banner: null };
  }
  return {
    fullAccess: true,
    inGrace: true,
    banner: 'Your payment method needs attention; update now to avoid interruption',
  };
}

export { legacyGraceEnds, suspendIfGraceExpired };
