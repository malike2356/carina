import { describe, expect, it, vi, beforeEach } from 'vitest';

const queryMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('./partner-service.js', () => ({
  getPartnerAccount: vi.fn(async () => ({
    id: 'partner-1',
    name: 'Acme Partner',
    commercialTier: 'agency',
    maxClientOrgs: 25,
  })),
  listClientOrganizations: vi.fn(async () => [
    { orgId: 'org-1', name: 'Client A', slug: 'client-a', plan: 'free', status: 'active', createdAt: '' },
    { orgId: 'org-2', name: 'Client B', slug: 'client-b', plan: 'free', status: 'active', createdAt: '' },
  ]),
}));

import { getPartnerBillingSummary } from './partner-billing.js';

describe('partner billing summaries', () => {
  beforeEach(() => {
    queryMock.mockReset();
    queryMock.mockImplementation(async (sql: string) => {
      if (/SELECT name, plan FROM organizations/.test(sql)) {
        return { rows: [{ name: 'Client A', plan: 'free' }], rowCount: 1 };
      }
      return { rows: [{ tokens: '1200', cost: '3.5' }], rowCount: 1 };
    });
  });

  it('aggregates per-workspace usage under a partner account', async () => {
    const summary = await getPartnerBillingSummary('partner-1', 30);
    expect(summary.partnerName).toBe('Acme Partner');
    expect(summary.commercialTier).toBe('agency');
    expect(summary.clientCount).toBe(2);
    expect(summary.clients).toHaveLength(2);
    expect(summary.totals.tokensUsed).toBe(2400);
  });
});
