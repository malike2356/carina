import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const unregisterMock = vi.fn(() => true);
const logSelfModEventMock = vi.fn(async () => undefined);

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../tools/registry.js', () => ({
  registry: {
    unregister: (...args: unknown[]) => unregisterMock(...args),
  },
}));

vi.mock('../security/self-mod-logger.js', () => ({
  logSelfModEvent: (...args: unknown[]) => logSelfModEventMock(...args),
}));

describe('pruneUnusedTools', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    unregisterMock.mockClear();
    logSelfModEventMock.mockClear();
    delete process.env.CARINA_MUTATION_PRUNE_AFTER_DAYS;
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('prunes active tool unused for more than PRUNE_AFTER_DAYS with low quality', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{ id: 'tool-1', name: 'stale-tool' }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const { pruneUnusedTools } = await import('./pruner.js');
    const names = await pruneUnusedTools(false);

    expect(names).toEqual(['stale-tool']);
    expect(poolQueryMock.mock.calls[1]?.[0]).toContain("status = 'disabled'");
    expect(unregisterMock).toHaveBeenCalledWith('stale-tool');
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOLS_PRUNED_UNUSED', expect.objectContaining({
      count: 1,
      tool_names: ['stale-tool'],
    }));
  });

  it('does not prune active tool with high quality score', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    const { pruneUnusedTools } = await import('./pruner.js');
    const names = await pruneUnusedTools(false);

    expect(names).toEqual([]);
    expect(unregisterMock).not.toHaveBeenCalled();
  });

  it('does not prune promoted tool even when unused and low quality', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });

    const { pruneUnusedTools } = await import('./pruner.js');
    const names = await pruneUnusedTools(false);

    expect(names).toEqual([]);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('promoted = FALSE');
  });

  it('dry run returns names without modifying db', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'tool-1', name: 'stale-tool' }],
    });

    const { pruneUnusedTools } = await import('./pruner.js');
    const names = await pruneUnusedTools(true);

    expect(names).toEqual(['stale-tool']);
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
    expect(unregisterMock).not.toHaveBeenCalled();
    expect(logSelfModEventMock).not.toHaveBeenCalled();
  });

  it('calls registry.unregister for each pruned tool', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [
          { id: 'tool-1', name: 'tool-a' },
          { id: 'tool-2', name: 'tool-b' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { pruneUnusedTools } = await import('./pruner.js');
    await pruneUnusedTools(false);

    expect(unregisterMock).toHaveBeenCalledTimes(2);
    expect(unregisterMock).toHaveBeenCalledWith('tool-a');
    expect(unregisterMock).toHaveBeenCalledWith('tool-b');
  });
});

describe('pruneExcessTools', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    unregisterMock.mockClear();
    logSelfModEventMock.mockClear();
    process.env.CARINA_MUTATION_PRUNE_MAX_TOOLS = '100';
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.CARINA_MUTATION_PRUNE_MAX_TOOLS;
    vi.resetModules();
  });

  it('removes lowest-quality tools when over max limit', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ count: '105' }] })
      .mockResolvedValueOnce({
        rows: [
          { id: 't1', name: 'low-1' },
          { id: 't2', name: 'low-2' },
          { id: 't3', name: 'low-3' },
          { id: 't4', name: 'low-4' },
          { id: 't5', name: 'low-5' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { pruneExcessTools } = await import('./pruner.js');
    const names = await pruneExcessTools(false);

    expect(names).toHaveLength(5);
    expect(poolQueryMock.mock.calls[1]?.[0]).toContain('ORDER BY COALESCE(quality_score');
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOLS_PRUNED_EXCESS', expect.objectContaining({
      count: 5,
      max_allowed: 100,
    }));
  });

  it('does not remove promoted tools', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ count: '105' }] })
      .mockResolvedValueOnce({ rows: [] });

    const { pruneExcessTools } = await import('./pruner.js');
    await pruneExcessTools(false);

    expect(poolQueryMock.mock.calls[1]?.[0]).toContain('promoted = FALSE');
  });

  it('returns empty array when under limit', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '50' }] });

    const { pruneExcessTools } = await import('./pruner.js');
    const names = await pruneExcessTools(false);

    expect(names).toEqual([]);
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
  });
});

describe('expireStagedOverrides', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('deletes staged-only overrides older than 30 days', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '3' }] });

    const { expireStagedOverrides } = await import('./pruner.js');
    const count = await expireStagedOverrides(false);

    expect(count).toBe(3);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('DELETE FROM system_prompt_overrides');
  });

  it('does not delete active overrides', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const { expireStagedOverrides } = await import('./pruner.js');
    await expireStagedOverrides(false);

    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('is_active = FALSE');
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('activated_at IS NULL');
  });

  it('dry run returns count without deleting', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '2' }] });

    const { expireStagedOverrides } = await import('./pruner.js');
    const count = await expireStagedOverrides(true);

    expect(count).toBe(2);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('SELECT COUNT');
    expect(poolQueryMock.mock.calls[0]?.[0]).not.toContain('DELETE');
  });
});

describe('runFullPrune', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    unregisterMock.mockClear();
    logSelfModEventMock.mockClear();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('calls all prune operations', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const { runFullPrune } = await import('./pruner.js');
    const report = await runFullPrune(false);

    expect(report.expiredProposals).toBe(1);
    expect(report.dryRun).toBe(false);
    expect(logSelfModEventMock).toHaveBeenCalledWith('FULL_PRUNE_COMPLETE', expect.any(Object));
  });

  it('dry run does not modify anything', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ count: '2' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1', name: 'stale' }] })
      .mockResolvedValueOnce({ rows: [{ count: '50' }] })
      .mockResolvedValueOnce({ rows: [{ count: '1' }] });

    const { runFullPrune } = await import('./pruner.js');
    const report = await runFullPrune(true);

    expect(report.dryRun).toBe(true);
    expect(report.expiredProposals).toBe(2);
    expect(report.prunedTools).toContain('stale');
    expect(unregisterMock).not.toHaveBeenCalled();
    expect(logSelfModEventMock).not.toHaveBeenCalled();
    expect(poolQueryMock.mock.calls.every((call) => !String(call[0]).includes('UPDATE runtime_tools'))).toBe(true);
    expect(poolQueryMock.mock.calls.every((call) => !String(call[0]).includes('DELETE FROM'))).toBe(true);
  });

  it('logs FULL_PRUNE_COMPLETE event', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ count: '0' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })
      .mockResolvedValueOnce({ rows: [{ count: '0' }] });

    const { runFullPrune } = await import('./pruner.js');
    await runFullPrune(false);

    expect(logSelfModEventMock).toHaveBeenCalledWith('FULL_PRUNE_COMPLETE', {
      pruned_tools: 0,
      expired_proposals: 0,
      expired_overrides: 0,
    });
  });

  it('deduplicates tool names across pruneUnused and pruneExcess', async () => {
    poolQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes('tool_gap_proposals') && sql.includes('SELECT COUNT')) {
        return { rows: [{ count: '0' }] };
      }
      if (sql.includes('runtime_tools') && sql.includes('COUNT(*) AS count') && !sql.includes('FILTER')) {
        return { rows: [{ count: '105' }] };
      }
      if (sql.includes('runtime_tools') && sql.includes('SELECT id, name')) {
        return { rows: [{ id: 't1', name: 'overlap-tool' }] };
      }
      if (sql.includes('system_prompt_overrides') && sql.includes('SELECT COUNT')) {
        return { rows: [{ count: '0' }] };
      }
      return { rows: [] };
    });

    const { runFullPrune } = await import('./pruner.js');
    const report = await runFullPrune(true);

    expect(report.prunedTools).toEqual(['overlap-tool']);
    expect(report.totalPruned).toBe(1);
  });
});
