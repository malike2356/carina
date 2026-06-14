import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../../memory/db.js', () => ({ pool: { query } }));

vi.mock('../../hosted/usage-service.js', () => ({
  maybeNotifyUsageWarning: vi.fn(async () => {}),
}));

describe('metering flow', () => {
  beforeEach(() => query.mockReset());

  it('debits balanced usage with weighted credits', async () => {
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    const { computeBillableCredits } = await import('../rate-card.js');
    const { debitCredits } = await import('../credit-ledger.js');

    const rateCard = {
      id: 2,
      modelClass: 'balanced' as const,
      inputWeight: 0.000006,
      outputWeight: 0.000024,
      cacheWeight: 0.0000015,
    };
    const credits = computeBillableCredits(rateCard, 1000, 500, 0);
    expect(credits).toBeGreaterThan(0);

    await debitCredits({
      orgId: 'org-1',
      sessionId: 'sess-1',
      model: 'gpt-4o',
      modelClass: 'balanced',
      rateCardId: 2,
      credits,
      providerCostUsd: 0.002,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("'usage'"),
      expect.arrayContaining(['org-1', -credits]),
    );
  });

  it('reduces remaining balance after a debit', async () => {
    query.mockResolvedValueOnce({
      rows: [{ event_type: 'usage', total: '-100000' }],
    });
    const { getMonthlyBalance } = await import('../credit-ledger.js');
    const balance = await getMonthlyBalance('org-1', 'carina_ops_starter');
    expect(balance.used).toBe(100_000);
    expect(balance.remaining).toBe(400_000);
  });
});

describe('credit gate integration scenarios', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('ops_plan_model_classes') && params?.[1] === 'frontier') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('ops_plan_model_classes') && params?.[1] === 'premium') {
        return { rows: [{ model_class: 'premium' }], rowCount: 1 };
      }
      if (sql.includes('ops_plan_model_classes')) {
        return { rows: [{ model_class: params?.[1] ?? 'balanced' }], rowCount: 1 };
      }
      if (sql.includes('GROUP BY event_type')) {
        return { rows: [{ event_type: 'usage', total: '-1000' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it('blocks frontier models on starter plans', async () => {
    const { checkCreditGate } = await import('../credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'frontier', 1);
    expect(result.modelClassAllowed).toBe(false);
    expect(result.allowed).toBe(false);
  });

  it('allows premium on team plans when balance remains', async () => {
    const { checkCreditGate } = await import('../credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_team', 'premium', 1000);
    expect(result.allowed).toBe(true);
    expect(result.modelClassAllowed).toBe(true);
  });

  it('blocks any model when balance is zero', async () => {
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('GROUP BY event_type')) {
        return { rows: [{ event_type: 'usage', total: '-500000' }], rowCount: 1 };
      }
      if (sql.includes('ops_plan_model_classes')) {
        return { rows: [{ model_class: params?.[1] ?? 'mini' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });
    const { checkCreditGate } = await import('../credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'mini', 1);
    expect(result.allowed).toBe(false);
  });
});

describe('topup flow', () => {
  beforeEach(() => query.mockReset());

  it('creditTopup increases effective balance', async () => {
    query
      .mockResolvedValueOnce({ rows: [], rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          { event_type: 'usage', total: '-500000' },
          { event_type: 'topup', total: '500000' },
        ],
      });
    const { creditTopup, getMonthlyBalance } = await import('../credit-ledger.js');
    await creditTopup('org-1', 500_000);
    const balance = await getMonthlyBalance('org-1', 'carina_ops_starter');
    expect(balance.topups).toBe(500_000);
    expect(balance.remaining).toBe(500_000);
  });
});
