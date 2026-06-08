import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  mockQuery.mockReset();
  delete process.env.CARINA_LLM_MONTHLY_BUDGET_USD;
  delete process.env.CARINA_LLM_DEEPSEEK_USD_PER_TOKEN;
});

async function loadTracker(budget?: string) {
  if (budget) process.env.CARINA_LLM_MONTHLY_BUDGET_USD = budget;
  vi.doMock('../memory/db.js', () => ({ pool: mockPool }));
  return import('./cost-tracker.js');
}

describe('recordUsage', () => {
  it('persists per-request usage with estimated cost', async () => {
    process.env.CARINA_LLM_DEEPSEEK_USD_PER_TOKEN = '0.001';
    mockQuery.mockResolvedValue({ rows: [] });
    const { recordUsage } = await loadTracker();

    await recordUsage('session-1', 'deepseek', 123, 'deepseek-chat');

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO model_usage'),
      ['session-1', 'deepseek', 'deepseek-chat', 123, 0.123],
    );
  });

  it('does not persist zero-token responses', async () => {
    const { recordUsage } = await loadTracker();
    await recordUsage('session-1', 'deepseek', 0, 'deepseek-chat');
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('cost reports', () => {
  it('aggregates monthly usage by provider and model', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { provider: 'anthropic', model: 'claude-sonnet-4-6', tokens_used: '1000', estimated_cost: '0.009' },
        { provider: 'deepseek', model: 'deepseek-chat', tokens_used: '2000', estimated_cost: '0.00056' },
      ],
    });
    const { getMonthlyReport } = await loadTracker();

    const report = await getMonthlyReport('2026-06');

    expect(report.totalTokens).toBe(3000);
    expect(report.totalCost).toBe(0.00956);
    expect(report.breakdown).toHaveLength(2);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('created_at >= $1::date'), ['2026-06-01']);
  });

  it('aggregates session usage by session id', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { provider: 'openai', model: 'gpt-4o', tokens_used: 500, estimated_cost: 0.00375 },
      ],
    });
    const { getSessionCost } = await loadTracker();

    const report = await getSessionCost('session-1');

    expect(report.totalTokens).toBe(500);
    expect(report.totalCost).toBe(0.00375);
    expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining('WHERE session_id = $1'), ['session-1']);
  });
});

describe('budget caps', () => {
  it('warns when the monthly budget reaches 80 percent', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { provider: 'anthropic', model: 'claude-sonnet-4-6', tokens_used: 1, estimated_cost: 8 },
      ],
    });
    const { checkMonthlyBudget } = await loadTracker('10');

    const status = await checkMonthlyBudget('2026-06');

    expect(status.status).toBe('warn');
    expect(status.message).toContain('warning');
  });

  it('blocks when the monthly budget reaches 100 percent', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { provider: 'anthropic', model: 'claude-sonnet-4-6', tokens_used: 1, estimated_cost: 10 },
      ],
    });
    const { checkMonthlyBudget } = await loadTracker('10');

    const status = await checkMonthlyBudget('2026-06');

    expect(status.status).toBe('blocked');
    expect(status.message).toContain('blocked');
  });
});
