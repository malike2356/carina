import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('./billing-config.js', () => ({
  resolveConfigValue: (key: string) => {
    if (key === 'AIVA_TRIAL_CREDIT_GBP') return '1';
    if (key === 'AIVA_TRIAL_DAILY_CAP_GBP') return '2';
    return '';
  },
}));

async function loadWallet() {
  vi.resetModules();
  return import('./aiva-ai-wallet.js');
}

function mockSchemaReady() {
  // CREATE TABLE + 3 indexes
  query
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] });
}

describe('aiva-ai-wallet', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('sums ledger balance excluding byok_usage', async () => {
    mockSchemaReady();
    query.mockResolvedValueOnce({
      rows: [
        { event_type: 'trial_grant', total: '100' },
        { event_type: 'debit', total: '-40' },
      ],
    });

    const { getAivaWalletBalance } = await loadWallet();
    const balance = await getAivaWalletBalance('ws-1');
    expect(balance.remainingPence).toBe(60);
    expect(balance.remainingGbp).toBe(0.6);
    expect(balance.debitedPence).toBe(40);
    expect(balance.exhausted).toBe(false);
  });

  it('grants trial credit once', async () => {
    mockSchemaReady();
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const { grantAivaTrialCredit } = await loadWallet();
    const result = await grantAivaTrialCredit('ws-1');
    expect(result.granted).toBe(true);
    expect(result.pence).toBe(100);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("'trial_grant'"),
      expect.arrayContaining(['ws-1', 100]),
    );
  });

  it('records byok usage at zero debit', async () => {
    mockSchemaReady();
    query.mockResolvedValueOnce({ rows: [], rowCount: 1 });

    const { recordAivaByokUsage } = await loadWallet();
    await recordAivaByokUsage({
      workspaceId: 'ws-1',
      model: 'gpt-4o-mini',
      usage: { inputTokens: 100, outputTokens: 50 },
    });
    const insertCall = query.mock.calls.find((c) => String(c[0]).includes("'byok_usage'"));
    expect(insertCall).toBeTruthy();
    expect(insertCall?.[1]?.[0]).toBe('ws-1');
  });

  it('denies managed calls when credit is exhausted and offers BYOK actions', async () => {
    mockSchemaReady();
    query
      .mockResolvedValueOnce({
        rows: [{ event_type: 'trial_grant', total: '100' }, { event_type: 'debit', total: '-100' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const { checkAivaWalletGate } = await loadWallet();
    const gate = await checkAivaWalletGate('ws-1', { planTier: 'trial', applyDailyCap: true });
    expect(gate.allowed).toBe(false);
    expect(gate.mode).toBe('denied');
    expect(gate.actions).toEqual(['byok', 'topup', 'upgrade']);
  });

  it('allows BYOK mode when credit is exhausted and a key exists', async () => {
    mockSchemaReady();
    query
      .mockResolvedValueOnce({
        rows: [{ event_type: 'trial_grant', total: '100' }, { event_type: 'debit', total: '-100' }],
      })
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

    const { checkAivaWalletGate } = await loadWallet();
    const gate = await checkAivaWalletGate('ws-1', { planTier: 'trial', applyDailyCap: true });
    expect(gate.allowed).toBe(true);
    expect(gate.mode).toBe('byok');
  });
});
