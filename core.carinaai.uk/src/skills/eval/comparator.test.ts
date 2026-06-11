import { describe, expect, it } from 'vitest';
import { buildBaselineComparison } from './comparator.js';
import type { EvalRunResult } from './types.js';

function mockRun(label: string, passRate: number, latency: number): EvalRunResult {
  const total = 4;
  const passCount = Math.round(passRate * total);
  return {
    runId: `run-${label}`,
    pack: 'test',
    label,
    passes: 1,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    fixtureResults: Array.from({ length: total }, (_, i) => ({
      fixtureId: `f${i}`,
      pass: i < passCount,
      latencyMs: latency,
      tokensUsed: 100,
      matchedSkills: [],
      assertionResults: [],
    })),
    metrics: {
      passRate,
      passCount,
      failCount: total - passCount,
      meanLatencyMs: latency,
      stdDevLatencyMs: 0,
      meanTokens: 100,
      stdDevTokens: 0,
      failuresByType: {},
    },
    thresholdsMet: passRate >= 0.9,
  };
}

describe('baseline vs candidate comparison', () => {
  it('detects improvement and new failures', () => {
    const baseline = mockRun('baseline', 0.5, 20);
    const candidate = mockRun('candidate', 0.75, 15);
    const cmp = buildBaselineComparison(baseline, candidate);
    expect(cmp.passRateDelta).toBe(0.25);
    expect(cmp.improved).toBe(true);
    expect(cmp.latencyDeltaMs).toBe(-5);
  });

  it('detects regression', () => {
    const baseline = mockRun('baseline', 1.0, 10);
    const candidate = mockRun('candidate', 0.5, 10);
    const cmp = buildBaselineComparison(baseline, candidate);
    expect(cmp.regression).toBe(true);
    expect(cmp.newFailures.length).toBeGreaterThan(0);
  });
});
