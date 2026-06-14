import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../api/hosted-billing.js', () => ({
  checkOrgUsageQuota: vi.fn(async (orgId: string) => {
    if (orgId === 'org-a') {
      return { allowed: true, warning: true, used: 400_000, limit: 500_000 };
    }
    return { allowed: true, warning: false, used: 50, limit: 2_000_000 };
  }),
}));

vi.mock('./scoped-query.js', () => ({
  orgOrTenantWhere: () => '(org_id = $1 OR (org_id IS NULL AND tenant_id = $2))',
  queryForOrg: vi.fn(async (orgId: string, sql: string, params?: unknown[]) => {
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

import {
  getCreditsStatus,
  getTodayUsage,
  getUsageByModel,
  getUsageSummary,
} from './usage-service.js';

describe('usage-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('getCreditsStatus warns at 80 percent', async () => {
    const credits = await getCreditsStatus('org-a', 'user-1');
    expect(credits.monthlyLimit).toBe(500_000);
    expect(credits.percentUsed).toBeGreaterThanOrEqual(80);
    expect(credits.warning).toBe(true);
  });

  it('getTodayUsage returns same-day totals', async () => {
    const today = await getTodayUsage('org-a', 'user-1');
    expect(today.tokens).toBe(50);
    expect(today.cost).toBe(0.1);
  });
});
