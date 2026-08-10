/**
 * Automated monthly P&L (JSON + markdown). Idempotent for a given stored month.
 */

import {
  listCostsInRange,
  listRevenueInRange,
  loadFinanceStore,
  monthDateRange,
  monthKey,
  mutateFinanceStore,
  sumMinor,
} from './finance-store.js';
import { collectAndAttributeMonth } from './cost-aggregator.js';
import { collectMonthRevenue, reconcileWithCosts } from './revenue-reconciler.js';
import { findLiabilityUsers } from './liability-detector.js';

export interface MonthlyPnL {
  year: number;
  month: number;
  monthLabel: string;
  currency: string;
  generatedAt: string;
  revenue: {
    subscriptionsMinor: number;
    oneTimeMinor: number;
    creditsMinor: number;
    refundsMinor: number;
    totalMinor: number;
  };
  cogs: {
    aiMinor: number;
    hostingMinor: number;
    thirdPartyMinor: number;
    otherMinor: number;
    totalMinor: number;
  };
  grossMarginMinor: number;
  grossMarginPct: number | null;
  perUser: {
    topByRevenue: Array<{ userId: string; revenueMinor: number; costMinor: number; marginMinor: number }>;
    topByCost: Array<{ userId: string; revenueMinor: number; costMinor: number; marginMinor: number }>;
    liabilities: Array<{ userId: string; revenueMinor: number; costMinor: number; ratio: number; action: string }>;
  };
  perFeature: Array<{ feature: string; costMinor: number; sharePct: number }>;
  checksum: {
    revenueSumMinor: number;
    costSumMinor: number;
    reconciles: boolean;
  };
}

function money(minor: number, currency = 'GBP'): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
  }).format(minor / 100);
}

export async function generateMonthlyPnL(
  year: number,
  month: number,
  opts?: { refresh?: boolean },
): Promise<MonthlyPnL> {
  const label = monthKey(year, month);
  const store = loadFinanceStore();
  if (!opts?.refresh && store.pnlSnapshots[label]) {
    return store.pnlSnapshots[label] as MonthlyPnL;
  }

  if (opts?.refresh !== false) {
    await collectAndAttributeMonth(year, month);
    await collectMonthRevenue(year, month);
  }

  const { from, to } = monthDateRange(year, month);
  const revenueRows = listRevenueInRange(from, to);
  const costRows = listCostsInRange(from, to).filter((c) => !c.userId.startsWith('__shared_'));
  const reconciled = reconcileWithCosts(year, month);
  const liabilities = findLiabilityUsers(1.0, year, month);

  const revenue = {
    subscriptionsMinor: sumMinor(revenueRows.filter((r) => r.kind === 'subscription')),
    oneTimeMinor: sumMinor(revenueRows.filter((r) => r.kind === 'one_time')),
    creditsMinor: sumMinor(revenueRows.filter((r) => r.kind === 'credits')),
    refundsMinor: sumMinor(revenueRows.filter((r) => r.kind === 'refund' || r.kind === 'chargeback')),
    totalMinor: sumMinor(revenueRows),
  };

  const cogs = {
    aiMinor: sumMinor(costRows.filter((c) => ['openai', 'anthropic', 'google'].includes(c.service))),
    hostingMinor: sumMinor(costRows.filter((c) => c.service === 'hosting')),
    thirdPartyMinor: sumMinor(costRows.filter((c) => c.service === 'third_party')),
    otherMinor: sumMinor(costRows.filter((c) => c.service === 'other')),
    totalMinor: sumMinor(costRows),
  };

  const grossMarginMinor = revenue.totalMinor - cogs.totalMinor;
  const grossMarginPct =
    revenue.totalMinor === 0
      ? null
      : Math.round((grossMarginMinor / revenue.totalMinor) * 10_000) / 100;

  const featureMap = new Map<string, number>();
  for (const c of costRows) {
    const feature = c.feature || c.service;
    featureMap.set(feature, (featureMap.get(feature) || 0) + c.amountMinor);
  }
  const featureTotal = sumMinor(costRows) || 1;
  const perFeature = [...featureMap.entries()]
    .map(([feature, costMinor]) => ({
      feature,
      costMinor,
      sharePct: Math.round((costMinor / featureTotal) * 10_000) / 100,
    }))
    .sort((a, b) => b.costMinor - a.costMinor);

  const pnl: MonthlyPnL = {
    year,
    month,
    monthLabel: label,
    currency: 'gbp',
    generatedAt: new Date().toISOString(),
    revenue,
    cogs,
    grossMarginMinor,
    grossMarginPct,
    perUser: {
      topByRevenue: reconciled.users.slice(0, 10).map((u) => ({
        userId: u.userId,
        revenueMinor: u.revenueMinor,
        costMinor: u.costMinor,
        marginMinor: u.marginMinor,
      })),
      topByCost: [...reconciled.users]
        .sort((a, b) => b.costMinor - a.costMinor)
        .slice(0, 10)
        .map((u) => ({
          userId: u.userId,
          revenueMinor: u.revenueMinor,
          costMinor: u.costMinor,
          marginMinor: u.marginMinor,
        })),
      liabilities: liabilities.map((l) => ({
        userId: l.userId,
        revenueMinor: l.revenueMinor,
        costMinor: l.costMinor,
        ratio: l.costToRevenueRatio,
        action: l.suggestedAction,
      })),
    },
    perFeature,
    checksum: {
      revenueSumMinor: revenue.totalMinor,
      costSumMinor: cogs.totalMinor,
      reconciles:
        revenue.totalMinor === reconciled.totalRevenueMinor
        && cogs.totalMinor === reconciled.totalCostMinor
        && grossMarginMinor === reconciled.grossMarginMinor,
    },
  };

  mutateFinanceStore((s) => {
    s.pnlSnapshots[label] = pnl;
  });

  return pnl;
}

export function renderMonthlyPnLMarkdown(pnl: MonthlyPnL): string {
  const lines = [
    `# P&L ${pnl.monthLabel}`,
    '',
    `Generated: ${pnl.generatedAt}`,
    '',
    '## Summary',
    `- Revenue: ${money(pnl.revenue.totalMinor)}`,
    `- COGS: ${money(pnl.cogs.totalMinor)}`,
    `- Gross margin: ${money(pnl.grossMarginMinor)} (${pnl.grossMarginPct ?? 'n/a'}%)`,
    `- Reconciles: ${pnl.checksum.reconciles ? 'yes' : 'NO'}`,
    '',
    '## Revenue',
    `- Subscriptions: ${money(pnl.revenue.subscriptionsMinor)}`,
    `- One-time: ${money(pnl.revenue.oneTimeMinor)}`,
    `- Credits: ${money(pnl.revenue.creditsMinor)}`,
    `- Refunds: ${money(pnl.revenue.refundsMinor)}`,
    '',
    '## COGS',
    `- AI: ${money(pnl.cogs.aiMinor)}`,
    `- Hosting: ${money(pnl.cogs.hostingMinor)}`,
    `- Third-party: ${money(pnl.cogs.thirdPartyMinor)}`,
    `- Other: ${money(pnl.cogs.otherMinor)}`,
    '',
    '## Top users by revenue',
    ...pnl.perUser.topByRevenue.map(
      (u) =>
        `- ${u.userId}: rev ${money(u.revenueMinor)} / cost ${money(u.costMinor)} / margin ${money(u.marginMinor)}`,
    ),
    '',
    '## Liability users',
    ...(pnl.perUser.liabilities.length === 0
      ? ['- None']
      : pnl.perUser.liabilities.map(
          (u) =>
            `- ${u.userId}: ratio ${u.ratio} → ${u.action} (rev ${money(u.revenueMinor)}, cost ${money(u.costMinor)})`,
        )),
    '',
    '## Cost by feature',
    ...pnl.perFeature.map((f) => `- ${f.feature}: ${money(f.costMinor)} (${f.sharePct}%)`),
  ];
  return lines.join('\n');
}

export function compareMonthOverMonth(
  current: MonthlyPnL,
  previous: MonthlyPnL,
): {
  revenueDeltaMinor: number;
  costDeltaMinor: number;
  marginDeltaMinor: number;
  revenueTrendPct: number | null;
  costTrendPct: number | null;
  marginTrendPct: number | null;
} {
  const revenueDeltaMinor = current.revenue.totalMinor - previous.revenue.totalMinor;
  const costDeltaMinor = current.cogs.totalMinor - previous.cogs.totalMinor;
  const marginDeltaMinor = current.grossMarginMinor - previous.grossMarginMinor;
  const pct = (delta: number, base: number) =>
    base === 0 ? null : Math.round((delta / Math.abs(base)) * 10_000) / 100;
  return {
    revenueDeltaMinor,
    costDeltaMinor,
    marginDeltaMinor,
    revenueTrendPct: pct(revenueDeltaMinor, previous.revenue.totalMinor),
    costTrendPct: pct(costDeltaMinor, previous.cogs.totalMinor),
    marginTrendPct: pct(marginDeltaMinor, previous.grossMarginMinor),
  };
}
