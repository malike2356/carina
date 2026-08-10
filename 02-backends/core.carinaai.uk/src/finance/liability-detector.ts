/**
 * Unprofitable (liability) user detection and action suggestions.
 */

import { monthDateRange } from './finance-store.js';
import { reconcileWithCosts } from './revenue-reconciler.js';

export type LiabilityAction = 'tier_upgrade' | 'usage_cap' | 'offboard' | 'monitor';

export interface LiabilityUser {
  userId: string;
  revenueMinor: number;
  costMinor: number;
  costToRevenueRatio: number;
  suggestedAction: LiabilityAction;
  rationale: string;
}

export function suggestAction(input: {
  revenueMinor: number;
  costMinor: number;
  ratio: number;
}): { action: LiabilityAction; rationale: string } {
  if (input.revenueMinor <= 0 && input.costMinor > 0) {
    return {
      action: 'offboard',
      rationale: 'Cost with no revenue; offboard or convert to paid immediately.',
    };
  }
  if (input.ratio >= 2) {
    return {
      action: 'offboard',
      rationale: 'Cost is at least 2x revenue; treat as liability unless strategic.',
    };
  }
  if (input.ratio >= 1.25) {
    return {
      action: 'usage_cap',
      rationale: 'Cost exceeds revenue materially; apply usage caps or rate limits.',
    };
  }
  if (input.ratio > 1) {
    return {
      action: 'tier_upgrade',
      rationale: 'Cost exceeds revenue; move to a higher tier or prepaid credits.',
    };
  }
  return {
    action: 'monitor',
    rationale: 'Margin acceptable; keep monitoring.',
  };
}

export function findLiabilityUsers(
  threshold = 1.0,
  year?: number,
  month?: number,
): LiabilityUser[] {
  const now = new Date();
  const y = year ?? now.getUTCFullYear();
  const m = month ?? now.getUTCMonth() + 1;
  const reconciled = reconcileWithCosts(y, m);
  return reconciled.users
    .filter((u) => {
      if (u.revenueMinor <= 0) return u.costMinor > 0;
      return u.costMinor / u.revenueMinor > threshold;
    })
    .map((u) => {
      const ratio =
        u.revenueMinor <= 0
          ? Number.POSITIVE_INFINITY
          : Math.round((u.costMinor / u.revenueMinor) * 1000) / 1000;
      const suggestion = suggestAction({
        revenueMinor: u.revenueMinor,
        costMinor: u.costMinor,
        ratio: Number.isFinite(ratio) ? ratio : 99,
      });
      return {
        userId: u.userId,
        revenueMinor: u.revenueMinor,
        costMinor: u.costMinor,
        costToRevenueRatio: Number.isFinite(ratio) ? ratio : 99,
        suggestedAction: suggestion.action,
        rationale: suggestion.rationale,
      };
    })
    .sort((a, b) => b.costToRevenueRatio - a.costToRevenueRatio);
}

export function trendAnalysis(
  userId: string,
  months: Array<{ year: number; month: number }>,
): {
  userId: string;
  points: Array<{ monthLabel: string; marginMinor: number }>;
  direction: 'improving' | 'worsening' | 'flat' | 'insufficient_data';
} {
  const points = months.map(({ year, month }) => {
    const row = reconcileWithCosts(year, month).users.find((u) => u.userId === userId);
    return {
      monthLabel: `${year}-${String(month).padStart(2, '0')}`,
      marginMinor: row?.marginMinor ?? 0,
    };
  });
  if (points.length < 2) {
    return { userId, points, direction: 'insufficient_data' };
  }
  const first = points[0]!.marginMinor;
  const last = points[points.length - 1]!.marginMinor;
  const delta = last - first;
  if (Math.abs(delta) < 100) return { userId, points, direction: 'flat' };
  return { userId, points, direction: delta > 0 ? 'improving' : 'worsening' };
}

/** Admin alert payload when liabilities exist. */
export function buildLiabilityAlert(year: number, month: number): {
  level: 'warning' | 'critical';
  count: number;
  message: string;
  users: LiabilityUser[];
} | null {
  const users = findLiabilityUsers(1.0, year, month);
  if (users.length === 0) return null;
  const critical = users.some((u) => u.suggestedAction === 'offboard');
  return {
    level: critical ? 'critical' : 'warning',
    count: users.length,
    message: `${users.length} liability user(s) where cost exceeds revenue in ${year}-${String(month).padStart(2, '0')}`,
    users,
  };
}

export function monthRangeHint(year: number, month: number) {
  return monthDateRange(year, month);
}
