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

describe('outcomeToScore and computeEma', () => {
  it('maps outcomes to scores', async () => {
    const { outcomeToScore, computeEma } = await import('./quality-recorder.js');
    expect(outcomeToScore('success')).toBe(1.0);
    expect(outcomeToScore('partial')).toBe(0.5);
    expect(outcomeToScore('failure')).toBe(0.0);
    expect(computeEma(null, 1.0)).toBe(1.0);
    expect(computeEma(1.0, 0.0)).toBeCloseTo(0.7, 5);
    expect(computeEma(0.7, 1.0)).toBeCloseTo(0.79, 5);
  });
});

describe('recordToolOutcome', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    unregisterMock.mockClear();
    logSelfModEventMock.mockClear();
    delete process.env.CARINA_MUTATION_QUALITY;
    delete process.env.CARINA_MUTATION_QUALITY_QUARANTINE;
    delete process.env.CARINA_MUTATION_QUALITY_PROMOTE;
    delete process.env.CARINA_MUTATION_QUALITY_PROMOTE_MIN_USES;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns early when CARINA_MUTATION_QUALITY=false', async () => {
    process.env.CARINA_MUTATION_QUALITY = 'false';
    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'generated-tool',
      tenantId: 'tenant-1',
      outcome: 'success',
    });
    expect(poolQueryMock).not.toHaveBeenCalled();
  });

  it('is a no-op for built-in tool names', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'web-search',
      tenantId: 'tenant-1',
      outcome: 'success',
    });
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain('SELECT id, quality_score');
  });

  it('computes EMA correctly: first sample sets score to sample value', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: null, times_used: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ promoted: false }] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'generated-tool',
      tenantId: 'tenant-1',
      outcome: 'success',
    });

    expect(poolQueryMock.mock.calls[2]?.[1]?.[0]).toBe(1.0);
  });

  it('computes EMA correctly: second sample applies alpha=0.3', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: 1.0, times_used: 1 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ promoted: false }] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'generated-tool',
      tenantId: 'tenant-1',
      outcome: 'failure',
    });

    expect(poolQueryMock.mock.calls[2]?.[1]?.[0]).toBeCloseTo(0.7, 5);
  });

  it('auto-quarantines when score falls below threshold', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: null, times_used: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'generated-tool',
      tenantId: 'tenant-1',
      outcome: 'failure',
    });

    expect(poolQueryMock.mock.calls[3]?.[0]).toContain("status = 'disabled'");
    expect(unregisterMock).toHaveBeenCalledWith('generated-tool');
  });

  it('unregisters tool from registry on quarantine', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: 0.2, times_used: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'bad-tool',
      tenantId: 'tenant-1',
      outcome: 'failure',
    });

    expect(unregisterMock).toHaveBeenCalledWith('bad-tool');
  });

  it('does not quarantine if score stays above threshold', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: 0.95, times_used: 2 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ promoted: false }] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'good-tool',
      tenantId: 'tenant-1',
      outcome: 'partial',
    });

    expect(unregisterMock).not.toHaveBeenCalled();
    expect(poolQueryMock.mock.calls.some((call) => String(call[0]).includes("status = 'disabled'"))).toBe(false);
  });

  it('auto-promotes after 5 uses above promote threshold', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: 0.9, times_used: 4 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ promoted: false }] })
      .mockResolvedValueOnce({ rows: [] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'star-tool',
      tenantId: 'tenant-1',
      outcome: 'success',
    });

    expect(poolQueryMock.mock.calls[4]?.[0]).toContain('promoted = TRUE');
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_AUTO_PROMOTED', expect.objectContaining({
      tool_name: 'star-tool',
    }));
  });

  it('does not promote twice for the same tool', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: 0.95, times_used: 10 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ promoted: true }] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'star-tool',
      tenantId: 'tenant-1',
      outcome: 'success',
    });

    expect(poolQueryMock.mock.calls.some((call) => String(call[0]).includes('promoted = TRUE'))).toBe(false);
  });

  it('logs TOOL_AUTO_QUARANTINE event on quarantine', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1', quality_score: null, times_used: 0 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const { recordToolOutcome } = await import('./quality-recorder.js');
    await recordToolOutcome({
      toolName: 'generated-tool',
      tenantId: 'tenant-1',
      outcome: 'failure',
    });

    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_AUTO_QUARANTINE', expect.objectContaining({
      tool_name: 'generated-tool',
    }));
  });
});

describe('getQualityHistory', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('returns samples newest-first', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: 's2',
          tool_id: 'tool-1',
          tenant_id: 't1',
          session_id: null,
          outcome: 'success',
          score: 1,
          error_summary: null,
          duration_ms: 10,
          sampled_at: '2026-07-06T12:00:00Z',
        },
        {
          id: 's1',
          tool_id: 'tool-1',
          tenant_id: 't1',
          session_id: 'sess',
          outcome: 'failure',
          score: 0,
          error_summary: 'boom',
          duration_ms: 20,
          sampled_at: '2026-07-06T11:00:00Z',
        },
      ],
    });

    const { getQualityHistory } = await import('./quality-recorder.js');
    const samples = await getQualityHistory('tool-1', 50);

    expect(samples).toHaveLength(2);
    expect(samples[0]?.id).toBe('s2');
    expect(samples[1]?.outcome).toBe('failure');
    expect(poolQueryMock.mock.calls[0]?.[1]?.[1]).toBe(50);
  });

  it('respects limit parameter', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { getQualityHistory } = await import('./quality-recorder.js');
    await getQualityHistory('tool-1', 10);
    expect(poolQueryMock.mock.calls[0]?.[1]?.[1]).toBe(10);
  });
});
