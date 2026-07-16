import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (/SUM\(tokens_used\)/.test(sql)) {
        return { rows: [{ total: params?.[0] === 'org-over' ? '500000' : '1000' }], rowCount: 1 };
      }
      if (/product_audit_log/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('../../hosted/scoped-query.js', () => ({
  orgOrTenantWhere: () => '(org_id = $1 OR (org_id IS NULL AND tenant_id = $2))',
  queryForOrg: vi.fn(async (orgId: string, sql: string) => {
    if (/SUM\(tokens_used\)/.test(sql)) {
      const used = orgId === 'org-over' ? '500000' : orgId === 'org-warn' ? '420000' : '1000';
      return { rows: [{ total: used }], rowCount: 1 };
    }
    if (/product_audit_log/.test(sql)) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }),
  resolveOrgIdFromUser: vi.fn(async () => 'org-a'),
}));

vi.mock('../../hosted/plan-gates.js', () => ({
  getOrgPlan: vi.fn(async (orgId: string) => {
    if (orgId === 'org-over' || orgId === 'org-warn') return 'carina_ops_starter';
    return 'carina_ops_team';
  }),
}));

vi.mock('../../billing/credit-ledger.js', () => ({
  getMonthlyBalance: vi.fn(async (orgId: string) => {
    if (orgId === 'org-over') return { used: 500_000, topups: 0 };
    if (orgId === 'org-warn') return { used: 420_000, topups: 0 };
    return { used: 1_000, topups: 0 };
  }),
}));

import { checkOrgUsageQuota } from '../hosted-billing.js';

describe('checkOrgUsageQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks workbench usage at 100 percent', async () => {
    const quota = await checkOrgUsageQuota('org-over', 'user-1');
    expect(quota.allowed).toBe(false);
    expect(quota.used).toBe(500_000);
    expect(quota.limit).toBe(500_000);
  });

  it('warns at 80 percent without blocking', async () => {
    const quota = await checkOrgUsageQuota('org-warn', 'user-1');
    expect(quota.allowed).toBe(true);
    expect(quota.warning).toBe(true);
  });
});
