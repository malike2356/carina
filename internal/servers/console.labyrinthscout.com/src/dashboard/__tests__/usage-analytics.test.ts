import { describe, expect, it } from 'vitest';
import { buildUsageAnalytics } from '../widgets/usage-analytics.js';

describe('buildUsageAnalytics', () => {
  it('sums token usage from metadata and JSON descriptions', () => {
    const summary = buildUsageAnalytics([
      { metadata: { tokens_used: 100 } },
      { metadata: '{"total_tokens":200}' },
      { metadata: {}, description: '{"tokens_used":300}' },
    ], 1000);

    expect(summary.used).toBe(600);
    expect(summary.limit).toBe(1000);
    expect(summary.percentage).toBe(60);
    expect(summary.estimated).toBe(true);
    expect(summary.label).toContain('not billing-grade');
  });

  it('caps percentage at 100', () => {
    const summary = buildUsageAnalytics([{ metadata: { tokens_used: 2000 } }], 1000);

    expect(summary.percentage).toBe(100);
    expect(summary.estimated).toBe(true);
  });
});
