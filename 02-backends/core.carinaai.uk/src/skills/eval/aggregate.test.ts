import { describe, expect, it } from 'vitest';
import { mean, stdDev, aggregateFixtureResults, checkThresholds, compareMetrics } from './aggregate.js';
import type { FixtureRunResult } from './types.js';

function fixture(id: string, pass: boolean, latency = 10, tokens = 0): FixtureRunResult {
  return {
    fixtureId: id,
    pass,
    latencyMs: latency,
    tokensUsed: tokens,
    matchedSkills: [],
    assertionResults: [],
  };
}

describe('benchmark aggregation', () => {
  it('computes mean and stddev', () => {
    expect(mean([10, 20, 30])).toBe(20);
    expect(stdDev([10, 20, 30])).toBeCloseTo(8.165, 2);
    expect(stdDev([5])).toBe(0);
  });

  it('aggregates pass rate and timing', () => {
    const metrics = aggregateFixtureResults([
      fixture('a', true, 10, 100),
      fixture('b', true, 20, 200),
      fixture('c', false, 30, 300),
    ]);
    expect(metrics.passRate).toBeCloseTo(2 / 3);
    expect(metrics.passCount).toBe(2);
    expect(metrics.failCount).toBe(1);
    expect(metrics.meanLatencyMs).toBe(20);
    expect(metrics.meanTokens).toBe(200);
  });

  it('checks thresholds', () => {
    const metrics = aggregateFixtureResults([
      fixture('a', true),
      fixture('b', true),
    ]);
    expect(checkThresholds(metrics, { minPassRate: 0.9 })).toBe(true);
    expect(checkThresholds(metrics, { minPassRate: 1.01 })).toBe(false);
    expect(checkThresholds(metrics, { maxMeanLatencyMs: 5 })).toBe(false);
  });

  it('compares baseline vs candidate metrics', () => {
    const baseline = aggregateFixtureResults([fixture('a', true), fixture('b', false)]);
    const candidate = aggregateFixtureResults([fixture('a', true), fixture('b', true)]);
    const cmp = compareMetrics(baseline, candidate);
    expect(cmp.passRateDelta).toBe(0.5);
    expect(cmp.improved).toBe(true);
    expect(cmp.regression).toBe(false);
  });
});
