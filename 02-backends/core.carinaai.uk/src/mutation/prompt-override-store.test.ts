import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const logSelfModEventMock = vi.fn(async () => undefined);

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../security/self-mod-logger.js', () => ({
  logSelfModEvent: (...args: unknown[]) => logSelfModEventMock(...args),
}));

const sampleRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'override-1',
  tenant_id: 'tenant-1',
  prompt_key: 'context_overlay',
  version: 1,
  content: 'Always use metric units.',
  is_active: false,
  created_by: 'learning_loop',
  rationale: 'User correction',
  confidence: 0.75,
  created_at: '2026-07-06T12:00:00Z',
  activated_at: null,
  ...overrides,
});

describe('getActiveOverlay', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('returns null when no override exists', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { promptOverrideStore } = await import('./prompt-override-store.js');
    expect(await promptOverrideStore.getActiveOverlay('tenant-1')).toBeNull();
  });

  it('returns content of the active version', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [{ content: 'Never use emojis.' }] });
    const { promptOverrideStore } = await import('./prompt-override-store.js');
    expect(await promptOverrideStore.getActiveOverlay('tenant-1')).toBe('Never use emojis.');
  });
});

describe('stageImprovement', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    logSelfModEventMock.mockClear();
    delete process.env.CARINA_MUTATION_PROMPT_AUTO_APPROVE_THRESHOLD;
  });

  it('stages below auto-approve threshold as inactive', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ max: 0 }] })
      .mockResolvedValueOnce({ rows: [sampleRow({ is_active: false })] });

    const { promptOverrideStore } = await import('./prompt-override-store.js');
    const record = await promptOverrideStore.stageImprovement({
      tenantId: 'tenant-1',
      content: 'When asked about dates, use ISO format.',
      rationale: 'User correction',
      confidence: 0.75,
      createdBy: 'learning_loop',
      autoApproveThreshold: 0.90,
    });

    expect(record.isActive).toBe(false);
    expect(poolQueryMock.mock.calls[1]?.[1]?.[3]).toBe(false);
    expect(logSelfModEventMock).toHaveBeenCalledWith('PROMPT_OVERRIDE_STAGED', expect.any(Object));
  });

  it('auto-approves and deactivates previous when above threshold', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ max: 1 }] })
      .mockResolvedValueOnce({ rows: [sampleRow({ version: 2, is_active: true })] })
      .mockResolvedValueOnce({ rows: [] });

    const { promptOverrideStore } = await import('./prompt-override-store.js');
    const record = await promptOverrideStore.stageImprovement({
      tenantId: 'tenant-1',
      content: 'Always confirm before deleting files.',
      rationale: 'User correction',
      confidence: 0.95,
      createdBy: 'learning_loop',
      autoApproveThreshold: 0.90,
    });

    expect(record.isActive).toBe(true);
    expect(poolQueryMock.mock.calls[2]?.[0]).toContain('is_active = FALSE');
    expect(logSelfModEventMock).toHaveBeenCalledWith('PROMPT_OVERRIDE_AUTO_APPROVED', expect.any(Object));
  });

  it('increments version number correctly', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ max: 3 }] })
      .mockResolvedValueOnce({ rows: [sampleRow({ version: 4 })] });

    const { promptOverrideStore } = await import('./prompt-override-store.js');
    await promptOverrideStore.stageImprovement({
      tenantId: 'tenant-1',
      content: 'When summarizing, keep bullets short.',
      rationale: 'test',
      confidence: 0.5,
      createdBy: 'learning_loop',
    });

    expect(poolQueryMock.mock.calls[1]?.[1]?.[1]).toBe(4);
  });
});

describe('activate', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    logSelfModEventMock.mockClear();
  });

  it('sets is_active on target version and deactivates others', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [sampleRow({ id: 'target-id' })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleRow({ id: 'target-id', is_active: true, activated_at: '2026-07-06T13:00:00Z' })] });

    const { promptOverrideStore } = await import('./prompt-override-store.js');
    const record = await promptOverrideStore.activate('target-id', 'operator');
    expect(record.isActive).toBe(true);
    expect(poolQueryMock.mock.calls[1]?.[0]).toContain('is_active = FALSE');
  });

  it('throws when id not found', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { promptOverrideStore } = await import('./prompt-override-store.js');
    await expect(promptOverrideStore.activate('missing', 'operator')).rejects.toThrow('not found');
  });
});

describe('rollback', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    logSelfModEventMock.mockClear();
  });

  it('restores most recently activated non-active version', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [sampleRow({ id: 'prev-id', version: 2, activated_at: '2026-07-05T12:00:00Z' })] })
      .mockResolvedValueOnce({ rows: [sampleRow({ id: 'prev-id', version: 2 })] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [sampleRow({ id: 'prev-id', version: 2, is_active: true })] });

    const { promptOverrideStore } = await import('./prompt-override-store.js');
    const restored = await promptOverrideStore.rollback('tenant-1', 'operator');
    expect(restored?.version).toBe(2);
    expect(logSelfModEventMock).toHaveBeenCalledWith('PROMPT_OVERRIDE_ROLLED_BACK', expect.any(Object));
  });

  it('returns null when no previous activated version exists', async () => {
    poolQueryMock.mockResolvedValueOnce({ rows: [] });
    const { promptOverrideStore } = await import('./prompt-override-store.js');
    expect(await promptOverrideStore.rollback('tenant-1', 'operator')).toBeNull();
  });
});

describe('getHistory', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
  });

  it('returns versions newest-first by version number', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [
        sampleRow({ id: 'v3', version: 3 }),
        sampleRow({ id: 'v2', version: 2 }),
      ],
    });
    const { promptOverrideStore } = await import('./prompt-override-store.js');
    const history = await promptOverrideStore.getHistory('tenant-1', 20);
    expect(history[0]?.version).toBe(3);
    expect(poolQueryMock.mock.calls[0]?.[1]?.[1]).toBe(20);
  });
});
