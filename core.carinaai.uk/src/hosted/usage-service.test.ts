import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../billing/credit-ledger.js', () => ({
  getMonthlyBalance: vi.fn(async (orgId: string) => ({
    used: orgId === 'org-a' ? 400_000 : 50,
    remaining: orgId === 'org-a' ? 100_000 : 1_950_000,
    percentUsed: orgId === 'org-a' ? 80 : 2.5,
    topups: orgId === 'org-a' ? 0 : 100_000,
    netLedger: orgId === 'org-a' ? -400_000 : -50,
  })),
  getModelMixForMonth: vi.fn(async (orgId: string) => (
    orgId === 'org-a'
      ? [{ modelClass: 'balanced', creditsUsed: 350_000, providerCostUsd: 12.5 }]
      : []
  )),
}));

vi.mock('../billing/credit-gate.js', () => ({
  getAllowedModelClasses: vi.fn(async (planId: string) => (
    planId === 'carina_ops_starter' ? ['mini', 'balanced'] : ['mini', 'balanced', 'premium']
  )),
}));

vi.mock('./plan-gates.js', () => ({
  getOrgPlan: vi.fn(async (orgId: string) =>
    (orgId === 'org-a' ? 'carina_ops_starter' : 'carina_ops_team')),
}));

vi.mock('./usage-warning-email.js', () => ({
  sendUsageWarningEmail: vi.fn(async () => true),
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (/organizations o/.test(sql)) {
        return { rows: [{ name: 'Org A', email: 'owner@example.com' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('../api/hosted-billing.js', () => ({
  checkOrgUsageQuota: vi.fn(async (orgId: string) => {
    if (orgId === 'org-a') {
      return { allowed: true, warning: true, used: 400_000, limit: 500_000 };
    }
    if (orgId === 'org-90') {
      return { allowed: true, warning: true, used: 450_000, limit: 500_000 };
    }
    return { allowed: true, warning: false, used: 50, limit: 2_000_000 };
  }),
}));

vi.mock('./scoped-query.js', () => ({
  orgOrTenantWhere: () => '(org_id = $1 OR (org_id IS NULL AND tenant_id = $2))',
  queryForOrg: vi.fn(async (orgId: string, sql: string) => {
    if (/GROUP BY date/.test(sql)) {
      if (orgId === 'org-a') {
        return {
          rows: [
            { date: '2026-06-01', tokens: '100', cost: '0.5' },
            { date: '2026-06-02', tokens: '200', cost: '1.0' },
          ],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    }
    if (/GROUP BY model/.test(sql)) {
      return {
        rows: [{ model: 'anthropic/claude-sonnet', tokens: '300', cost: '1.5', requests: '2' }],
        rowCount: 1,
      };
    }
    if (/date_trunc\('month'/.test(sql)) {
      return { rows: [{ total: orgId === 'org-a' ? '400000' : '0' }], rowCount: 1 };
    }
    if (/date = CURRENT_DATE/.test(sql)) {
      return { rows: [{ tokens: '50', cost: '0.1' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

import { sendUsageWarningEmail } from './usage-warning-email.js';
import {
  getCreditsStatus,
  getTodayUsage,
  getUsageByModel,
  getUsageSummary,
  getUsageWarningThreshold,
  maybeNotifyUsageWarning,
  resetUsageWarningEmailState,
} from './usage-service.js';

describe('usage-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetUsageWarningEmailState();
  });

  it('getUsageSummary aggregates daily rows for org', async () => {
    const summary = await getUsageSummary('org-a', 'user-1', 30);
    expect(summary.totalTokens).toBe(300);
    expect(summary.totalCost).toBe(1.5);
    expect(summary.daily).toHaveLength(2);
  });

  it('getUsageByModel returns model breakdown', async () => {
    const rows = await getUsageByModel('org-a', 'user-1', 30);
    expect(rows[0]).toMatchObject({ provider: 'anthropic', model: 'claude-sonnet', requests: 2 });
  });

  it('getCreditsStatus warns at 80 percent with credit fields', async () => {
    const credits = await getCreditsStatus('org-a', 'user-1');
    expect(credits.unit).toBe('credits');
    expect(credits.monthlyLimit).toBe(500_000);
    expect(credits.creditsIncluded).toBe(500_000);
    expect(credits.percentUsed).toBeGreaterThanOrEqual(80);
    expect(credits.warning).toBe(true);
    expect(credits.allowedClasses).toEqual(['mini', 'balanced']);
    expect(credits.highestModelClass).toBe('balanced');
    expect(credits.modelMix[0]).toMatchObject({ modelClass: 'balanced', creditsUsed: 350_000 });
  });

  it('getTodayUsage returns same-day totals', async () => {
    const today = await getTodayUsage('org-a', 'user-1');
    expect(today.tokens).toBe(50);
    expect(today.cost).toBe(0.1);
  });

  it('getUsageWarningThreshold maps usage levels to warning tiers', () => {
    const limit = 500_000;
    expect(getUsageWarningThreshold(399_999, limit)).toBeNull();
    expect(getUsageWarningThreshold(400_000, limit)).toBe(80);
    expect(getUsageWarningThreshold(449_999, limit)).toBe(80);
    expect(getUsageWarningThreshold(450_000, limit)).toBe(90);
    expect(getUsageWarningThreshold(500_000, limit)).toBe(100);
  });

  it('maybeNotifyUsageWarning triggers email at 80 percent usage', async () => {
    await maybeNotifyUsageWarning('org-a', 'user-1');
    expect(sendUsageWarningEmail).toHaveBeenCalledWith(expect.objectContaining({
      threshold: 80,
      used: 400_000,
      limit: 500_000,
      unit: 'credits',
    }));
  });

  it('maybeNotifyUsageWarning triggers email at 90 percent usage', async () => {
    await maybeNotifyUsageWarning('org-90', 'user-1', {
      used: 450_000,
      limit: 500_000,
      unit: 'credits',
    });
    expect(sendUsageWarningEmail).toHaveBeenCalledWith(expect.objectContaining({
      threshold: 90,
      used: 450_000,
      limit: 500_000,
      unit: 'credits',
    }));
  });
});
