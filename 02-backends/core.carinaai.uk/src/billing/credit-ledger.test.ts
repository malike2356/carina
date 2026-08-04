import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

vi.mock('../hosted/usage-service.js', () => ({
  maybeNotifyUsageWarning: vi.fn(async () => {}),
}));

describe('credit-ledger', () => {
  beforeEach(() => query.mockReset());

  it('debits credits as negative ledger rows', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    const { debitCredits } = await import('./credit-ledger.js');
    await debitCredits({
      orgId: 'org-1',
      sessionId: 'sess-1',
      model: 'gpt-4o',
      modelClass: 'balanced',
      rateCardId: 2,
      credits: 12.5,
      providerCostUsd: 0.001,
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("event_type, credits"),
      expect.arrayContaining(['org-1', -12.5]),
    );
  });

  it('records topups as positive credits', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    const { creditTopup } = await import('./credit-ledger.js');
    await creditTopup('org-1', 500_000, 'manual');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("'topup'"),
      ['org-1', 500_000, 'manual'],
    );
  });

  it('computes monthly balance from ledger sums', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          { event_type: 'usage', total: '-300000' },
          { event_type: 'topup', total: '100000' },
        ],
      });
    const { getMonthlyBalance } = await import('./credit-ledger.js');
    const balance = await getMonthlyBalance('org-1', 'carina_ops_starter');
    expect(balance.used).toBe(300_000);
    expect(balance.topups).toBe(100_000);
    expect(balance.remaining).toBe(300_000);
  });
});
