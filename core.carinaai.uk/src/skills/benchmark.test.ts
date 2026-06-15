import { describe, expect, it, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockDeps(rows: Record<string, unknown>[]) {
  vi.doMock('../memory/db.js', () => ({
    pool: {
      query: vi.fn().mockResolvedValue({ rows }),
    },
    initDb: vi.fn().mockResolvedValue(undefined),
  }));
  vi.doMock('../memory/store.js', () => ({
    saveMemory: vi.fn().mockResolvedValue(undefined),
  }));
}

describe('runCompoundingBenchmark', () => {
  it('returns topSkills and summary when skills exist', async () => {
    mockDeps([
      { name: 'skill-a', description: 'A skill', usage_count: 10, success_count: 8, failure_count: 2 },
      { name: 'skill-b', description: 'B skill', usage_count: 5, success_count: 3, failure_count: 2 },
    ]);
    const { runCompoundingBenchmark } = await import('./benchmark.js');
    const report = await runCompoundingBenchmark('test-session');
    expect(report.topSkills).toHaveLength(2);
    expect(report.topSkills[0]!.name).toBe('skill-a');
    expect(report.topSkills[0]!.successRate).toBe(80);
    expect(report.topSkills[1]!.successRate).toBe(60);
    expect(report.summary).toContain('2 most-used skills');
    expect(report.summary).toContain('avg 70% success rate');
  });

  it('returns empty topSkills and 0% avg when no skills', async () => {
    mockDeps([]);
    const { runCompoundingBenchmark } = await import('./benchmark.js');
    const report = await runCompoundingBenchmark('test-session');
    expect(report.topSkills).toHaveLength(0);
    expect(report.summary).toContain('0 most-used skills');
    expect(report.summary).toContain('avg 0% success rate');
  });

  it('reports 0% success rate when no successes or failures recorded', async () => {
    mockDeps([
      { name: 'skill-c', description: 'C skill', usage_count: 3, success_count: 0, failure_count: 0 },
    ]);
    const { runCompoundingBenchmark } = await import('./benchmark.js');
    const report = await runCompoundingBenchmark();
    expect(report.topSkills[0]!.successRate).toBe(0);
  });
});
