import { describe, expect, it } from 'vitest';
import { buildCuratorReviewReportFromLists } from './curator-report.js';

describe('curator-report', () => {
  it('builds stale skill recommendations', () => {
    const report = buildCuratorReviewReportFromLists({
      active: [{
        id: '1',
        name: 'old-skill',
        description: 'test',
        trigger: [],
        steps: 'x',
        toolsUsed: [],
        createdAt: new Date('2020-01-01'),
        usageCount: 0,
        status: 'active',
      }],
      archived: [],
      pruned: [],
      staleCandidates: ['old-skill'],
      maxAgeDays: 90,
      minUsage: 0,
    });

    expect(report.summary.staleCandidates).toBe(1);
    expect(report.staleCandidates[0]?.name).toBe('old-skill');
    expect(report.recommendations[0]).toContain('carina curator prune');
  });
});
