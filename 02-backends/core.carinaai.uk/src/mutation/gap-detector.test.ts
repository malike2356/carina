import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const logSelfModEventMock = vi.fn(async () => undefined);

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../security/self-mod-logger.js', () => ({
  logSelfModEvent: (...args: unknown[]) => logSelfModEventMock(...args),
}));

describe('onToolMiss', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    logSelfModEventMock.mockClear();
    delete process.env.CARINA_AUTO_SYNTHESIS;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('is a no-op when CARINA_AUTO_SYNTHESIS is not true', async () => {
    const { onToolMiss } = await import('./gap-detector.js');
    const result = await onToolMiss({
      toolName: 'weather_lookup',
      tenantId: 'tenant-1',
    });
    expect(result).toBeNull();
    expect(poolQueryMock).not.toHaveBeenCalled();
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_GAP_DETECTED', expect.objectContaining({
      tool_name: 'weather_lookup',
      auto_synthesis: false,
    }));
  });

  it('inserts a gap proposal when auto-synthesis is enabled', async () => {
    process.env.CARINA_AUTO_SYNTHESIS = 'true';
    poolQueryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'prop-1', proposed_at: '2026-07-06T12:00:00Z' }] });

    const { onToolMiss } = await import('./gap-detector.js');
    const result = await onToolMiss({
      toolName: 'weather_lookup',
      tenantId: 'tenant-1',
      sessionId: 'sess-1',
      taskContext: 'Need weather for London',
    });

    expect(result).toMatchObject({
      id: 'prop-1',
      missingTool: 'weather_lookup',
      status: 'pending',
    });
    expect(poolQueryMock.mock.calls[2]?.[0]).toContain('INSERT INTO tool_gap_proposals');
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_GAP_PROPOSED', expect.objectContaining({
      tool_name: 'weather_lookup',
      proposal_id: 'prop-1',
    }));
  });

  it('deduplicates: same tool + tenant within 1 hour returns null', async () => {
    process.env.CARINA_AUTO_SYNTHESIS = 'true';
    poolQueryMock.mockResolvedValueOnce({ rows: [{ id: 'existing', status: 'pending' }] });

    const { onToolMiss } = await import('./gap-detector.js');
    const result = await onToolMiss({
      toolName: 'weather_lookup',
      tenantId: 'tenant-1',
    });

    expect(result).toBeNull();
    expect(poolQueryMock).toHaveBeenCalledTimes(1);
  });

  it('skips proposal when active tool with that name exists', async () => {
    process.env.CARINA_AUTO_SYNTHESIS = 'true';
    poolQueryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'tool-1' }] });

    const { onToolMiss } = await import('./gap-detector.js');
    const result = await onToolMiss({
      toolName: 'weather_lookup',
      tenantId: 'tenant-1',
    });

    expect(result).toBeNull();
    expect(poolQueryMock).toHaveBeenCalledTimes(2);
  });

  it('logs TOOL_GAP_DETECTED when auto-synthesis is disabled', async () => {
    const { onToolMiss } = await import('./gap-detector.js');
    await onToolMiss({ toolName: 'missing_tool', tenantId: 't1' });
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_GAP_DETECTED', expect.any(Object));
  });

  it('logs TOOL_GAP_PROPOSED only when proposal is inserted', async () => {
    process.env.CARINA_AUTO_SYNTHESIS = 'true';
    poolQueryMock
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'prop-2', proposed_at: '2026-07-06T12:00:00Z' }] });

    const { onToolMiss } = await import('./gap-detector.js');
    await onToolMiss({ toolName: 'new_tool', tenantId: 't1' });

    expect(logSelfModEventMock).not.toHaveBeenCalledWith('TOOL_GAP_DETECTED', expect.any(Object));
    expect(logSelfModEventMock).toHaveBeenCalledWith('TOOL_GAP_PROPOSED', expect.any(Object));
  });
});

describe('expireStaleProposals', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('sets status=expired for old pending proposals and returns count', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '3' }] });
    const { expireStaleProposals } = await import('./gap-detector.js');
    const count = await expireStaleProposals(7);
    expect(count).toBe(3);
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain("status = 'expired'");
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain("status = 'pending'");
  });

  it('returns zero when nothing expired', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    const { expireStaleProposals } = await import('./gap-detector.js');
    expect(await expireStaleProposals(30)).toBe(0);
  });
});

describe('listGapProposals and dismissGapProposal', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('lists proposals for tenant', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{
        id: 'p1',
        tenant_id: 't1',
        session_id: null,
        missing_tool: 'weather_lookup',
        task_context: null,
        status: 'pending',
        proposed_at: '2026-07-06T12:00:00Z',
        tool_id: null,
      }],
    });
    const { listGapProposals } = await import('./gap-detector.js');
    const proposals = await listGapProposals({ tenantId: 't1', status: 'pending' });
    expect(proposals[0]?.missingTool).toBe('weather_lookup');
  });

  it('dismisses a proposal', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { dismissGapProposal } = await import('./gap-detector.js');
    await dismissGapProposal('p1');
    expect(poolQueryMock.mock.calls[0]?.[0]).toContain("status = 'dismissed'");
  });
});
