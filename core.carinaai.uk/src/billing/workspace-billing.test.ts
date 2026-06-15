import { describe, expect, it, vi } from 'vitest';

vi.mock('./usage-meter.js', () => ({
  UsageMeter: class {
    async statusForOrg(_orgId: string, tenantId: string) {
      return {
        tokensUsed: tenantId === 't1' ? 100 : 50,
        limit: 1000,
      };
    }
  },
}));

vi.mock('./credit-ledger.js', () => ({
  getMonthlyBalance: async () => ({ used: 120, topups: 0 }),
}));

import { buildWorkspaceBillingSummary } from './workspace-billing.js';

describe('workspace-billing', () => {
  it('aggregates member usage', async () => {
    const summary = await buildWorkspaceBillingSummary({
      orgId: 'org-1',
      plan: 'carina_ops_team',
      tenantIds: ['t1', 't2'],
    });
    expect(summary.members).toHaveLength(2);
    expect(summary.totals.tokensUsed).toBe(150);
    expect(summary.usageBased).toBe(true);
  });
});
