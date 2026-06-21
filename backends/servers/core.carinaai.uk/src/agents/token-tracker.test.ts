import { describe, expect, it } from 'vitest';
import { getTokenTracker, maybeTokenSpendAlert, tokenAlertThresholdUsd } from './token-tracker.js';

describe('token-tracker', () => {
  it('accumulates session usage and estimates cost', () => {
    const tracker = getTokenTracker();
    tracker.reset('sess-a');
    const row = tracker.record('sess-a', 'claude-sonnet-4', {
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(row.totalTokens).toBe(1_000_000);
    expect(row.estimatedCost).toBeGreaterThan(0);
    expect(tracker.formatSessionSummary('sess-a')).toContain('Session tokens');
  });

  it('fires spend alert above threshold', () => {
    const tracker = getTokenTracker();
    tracker.reset('sess-alert');
    tracker.record('sess-alert', 'claude-opus-4', {
      inputTokens: 500_000,
      outputTokens: 500_000,
    });
    const threshold = tokenAlertThresholdUsd();
    const usage = tracker.get('sess-alert');
    expect(usage?.estimatedCost).toBeGreaterThanOrEqual(threshold);
    expect(maybeTokenSpendAlert('sess-alert')).toContain('Token spend alert');
  });
});
