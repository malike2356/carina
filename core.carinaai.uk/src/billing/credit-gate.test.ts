import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

vi.mock('./credit-ledger.js', () => ({
  getMonthlyBalance: vi.fn(async () => ({
    used: 100_000,
    remaining: 400_000,
    percentUsed: 20,
    topups: 0,
    netLedger: -100_000,
  })),
}));

describe('credit-gate', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('ops_plan_model_classes') && params?.[1] === 'frontier') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('ops_plan_model_classes')) {
        return { rows: [{ model_class: params?.[1] ?? 'balanced' }], rowCount: 1 };
      }
      if (sql.includes('SELECT model_class FROM ops_plan_model_classes')) {
        return {
          rows: [{ model_class: 'mini' }, { model_class: 'balanced' }],
          rowCount: 2,
        };
      }
      return { rows: [], rowCount: 0 };
    });
  });

  it('allows when balance is sufficient and model class is permitted', async () => {
    const { checkCreditGate } = await import('./credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'balanced', 1000);
    expect(result.allowed).toBe(true);
    expect(result.modelClassAllowed).toBe(true);
  });

  it('blocks when balance is zero', async () => {
    const ledger = await import('./credit-ledger.js');
    vi.mocked(ledger.getMonthlyBalance).mockResolvedValueOnce({
      used: 500_000,
      remaining: 0,
      percentUsed: 100,
      topups: 0,
      netLedger: -500_000,
    });
    const { checkCreditGate } = await import('./credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'mini', 1);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('exhausted');
  });

  it('returns modelClassAllowed false for disallowed classes', async () => {
    const { checkCreditGate } = await import('./credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'frontier', 1);
    expect(result.allowed).toBe(false);
    expect(result.modelClassAllowed).toBe(false);
  });

  it('always allows enterprise plans with unlimited credits', async () => {
    const { checkCreditGate } = await import('./credit-gate.js');
    const result = await checkCreditGate('org-1', 'enterprise', 'frontier', 999_999);
    expect(result.allowed).toBe(true);
    expect(result.remainingCredits).toBe(Number.POSITIVE_INFINITY);
  });

  it('warns when estimated credits exceed remaining balance without blocking', async () => {
    const ledger = await import('./credit-ledger.js');
    vi.mocked(ledger.getMonthlyBalance).mockResolvedValueOnce({
      used: 490_000,
      remaining: 10_000,
      percentUsed: 98,
      topups: 0,
      netLedger: -490_000,
    });
    const { checkCreditGate } = await import('./credit-gate.js');
    const result = await checkCreditGate('org-1', 'carina_ops_starter', 'balanced', 50_000);
    expect(result.allowed).toBe(true);
    expect(result.reason).toContain('warning');
  });
});
