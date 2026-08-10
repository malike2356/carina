/**
 * Dunning recovery monitoring stats.
 */

import { loadDunningStore, type DunningCase, type DunningEmailStage } from './dunning-store.js';

export interface DunningStats {
  from: string;
  to: string;
  failedPayments: number;
  recoveredPayments: number;
  cancelledPayments: number;
  activeDunning: number;
  recoveryRatePct: number;
  atRiskMrrMinor: number;
  recoveryByEmailStage: Array<{ stage: DunningEmailStage; recoveredAfterStage: number }>;
  recoveryByRetryDay: Array<{ dayOffset: number; recoveredCount: number }>;
  meetsRecoveryTarget: boolean;
}

function inRange(iso: string, fromMs: number, toMs: number): boolean {
  const t = Date.parse(iso);
  return Number.isFinite(t) && t >= fromMs && t <= toMs;
}

export function getDunningStats(dateRange?: { from?: string; to?: string }): DunningStats {
  const from = dateRange?.from ?? '1970-01-01T00:00:00.000Z';
  const to = dateRange?.to ?? new Date().toISOString();
  const fromMs = Date.parse(from);
  const toMs = Date.parse(to);
  const cases = loadDunningStore().cases.filter((c) => inRange(c.failedAt, fromMs, toMs));

  const failedPayments = cases.length;
  const recoveredPayments = cases.filter((c) => c.status === 'recovered').length;
  const cancelledPayments = cases.filter((c) => c.status === 'cancelled' || c.status === 'exhausted').length;
  const activeDunning = cases.filter((c) => c.status === 'active').length;
  const closed = recoveredPayments + cancelledPayments;
  const recoveryRatePct =
    closed === 0 ? 0 : Math.round((recoveredPayments / closed) * 1000) / 10;

  const atRiskMrrMinor = cases
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + (c.mrrMinor ?? c.amountDueMinor ?? 0), 0);

  const recoveryByEmailStage: DunningStats['recoveryByEmailStage'] = [1, 2, 3].map((stage) => {
    const recoveredAfterStage = cases.filter((c) => {
      if (c.status !== 'recovered' || !c.recoveredAt) return false;
      const email = c.emails.find((e) => e.stage === stage);
      if (!email?.sentAt) return false;
      const next = c.emails.find((e) => e.stage === ((stage + 1) as DunningEmailStage));
      const recoveredMs = Date.parse(c.recoveredAt);
      const sentMs = Date.parse(email.sentAt);
      if (recoveredMs < sentMs) return false;
      if (next?.sentAt && recoveredMs >= Date.parse(next.sentAt)) return false;
      return true;
    }).length;
    return { stage: stage as DunningEmailStage, recoveredAfterStage };
  });

  const recoveryByRetryDay = [1, 3, 5, 7, 14].map((dayOffset) => ({
    dayOffset,
    recoveredCount: cases.filter((c) => {
      if (c.status !== 'recovered') return false;
      const retry = c.retries.find((r) => r.dayOffset === dayOffset && r.result === 'succeeded');
      return Boolean(retry);
    }).length,
  }));

  return {
    from,
    to,
    failedPayments,
    recoveredPayments,
    cancelledPayments,
    activeDunning,
    recoveryRatePct,
    atRiskMrrMinor,
    recoveryByEmailStage,
    recoveryByRetryDay,
    meetsRecoveryTarget: recoveryRatePct >= 30 || closed === 0,
  };
}

export function getAtRiskMRR(): { atRiskMrrMinor: number; activeCases: number } {
  const active = loadDunningStore().cases.filter((c) => c.status === 'active');
  return {
    activeCases: active.length,
    atRiskMrrMinor: active.reduce((sum, c) => sum + (c.mrrMinor ?? c.amountDueMinor ?? 0), 0),
  };
}

export function getRecoveryRateByStage() {
  return getDunningStats().recoveryByEmailStage;
}

/** Lightweight churn hint: active dunning with no portal clicks. */
export function predictChurnRisk(): Array<{ workspaceId: string; reason: string; caseId: string }> {
  return loadDunningStore()
    .cases.filter((c) => c.status === 'active')
    .filter((c) => c.emails.every((e) => !e.clickedAt))
    .map((c) => ({
      workspaceId: c.workspaceId,
      caseId: c.id,
      reason: 'In dunning with no payment portal clicks yet',
    }));
}

export function listDunningCases(): DunningCase[] {
  return loadDunningStore().cases;
}
