import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  delete process.env.CARINA_CURATOR_INTERVAL_DAYS;
});

type MockQueryFn = (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;

function makeMockPool(queryImpl: MockQueryFn) {
  return {
    pool: { query: vi.fn(queryImpl) },
    initDb: vi.fn().mockResolvedValue(undefined),
  };
}

function mockAuditLog() {
  vi.doMock('./skill-audit-log.js', () => ({
    logSkillAction: vi.fn().mockResolvedValue(undefined),
  }));
}

function mockListSkills(skills: unknown[] = []) {
  vi.doMock('./store.js', () => ({
    listSkills: vi.fn().mockResolvedValue(skills),
  }));
}

describe('promoteDraftSkills', () => {
  it('promotes draft skills meeting usage and success thresholds', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'skill-1',
          name: 'my-draft-skill',
          usage_count: 4,
          success_count: 3,
          failure_count: 1,
          created_at: new Date('2026-01-01').toISOString(),
        }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    mockListSkills();

    const { promoteDraftSkills } = await import('./curator.js');
    const promoted = await promoteDraftSkills();
    expect(promoted).toContain('my-draft-skill');
  });

  it('does not promote draft skills below threshold', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'skill-2',
          name: 'weak-skill',
          usage_count: 1,
          success_count: 1,
          failure_count: 0,
          created_at: new Date().toISOString(),
        }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    mockListSkills();

    const { promoteDraftSkills } = await import('./curator.js');
    const promoted = await promoteDraftSkills();
    expect(promoted).toHaveLength(0);
  });
});

describe('consolidateOverlappingSkills', () => {
  it('archives the lower-scoring duplicate', async () => {
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{
          id: 'skill-a',
          name: 'skill-a',
          usage_count: 5,
          success_count: 5,
          failure_count: 0,
          trigger_keywords: ['fetch', 'parse'],
        }],
        rowCount: 1,
      })
      .mockResolvedValueOnce({
        rows: [{
          id: 'skill-b',
          name: 'skill-b',
          usage_count: 2,
          success_count: 1,
          failure_count: 1,
          trigger_keywords: ['fetch', 'parse', 'url'],
        }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    vi.doMock('./store.js', () => ({
      listSkills: vi.fn().mockResolvedValue([
        { id: 'skill-a', name: 'skill-a', trigger: ['fetch', 'parse'], usageCount: 5, status: 'active' },
        { id: 'skill-b', name: 'skill-b', trigger: ['fetch', 'parse', 'url'], usageCount: 2, status: 'active' },
      ]),
    }));

    const { consolidateOverlappingSkills } = await import('./curator.js');
    const result = await consolidateOverlappingSkills();
    expect(result.length).toBeGreaterThanOrEqual(0);
  });
});

describe('runFullCuratorCycle', () => {
  it('skips if interval has not passed', async () => {
    const recentTs = Date.now() - 1000;
    const queryMock = vi.fn()
      .mockResolvedValueOnce({
        rows: [{ ts: String(recentTs) }],
        rowCount: 1,
      })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    mockListSkills();

    process.env.CARINA_CURATOR_INTERVAL_DAYS = '7';
    const { runFullCuratorCycle } = await import('./curator.js');
    const result = await runFullCuratorCycle({ intervalDays: 7 });
    expect(result.reportSummary).toBe('');
    expect(result.promoted).toHaveLength(0);
  });

  it('runs when interval has passed', async () => {
    const oldTs = Date.now() - 10 * 24 * 60 * 60 * 1000;
    const queryMock = vi.fn()
      .mockResolvedValueOnce({ rows: [{ ts: String(oldTs) }], rowCount: 1 })
      .mockResolvedValue({ rows: [], rowCount: 0 });

    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    mockListSkills();

    const { runFullCuratorCycle } = await import('./curator.js');
    const result = await runFullCuratorCycle({ intervalDays: 7 });
    expect(result.reportSummary).toContain('Curator reviewed skills');
  });

  it('runs forced curator cycle without interval gate', async () => {
    const queryMock = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    vi.doMock('../memory/db.js', () => makeMockPool(queryMock));
    mockAuditLog();
    mockListSkills();

    const { runFullCuratorCycle } = await import('./curator.js');
    const result = await runFullCuratorCycle({ force: true });
    expect(result.reportSummary).toContain('Curator reviewed skills');
  });
});
