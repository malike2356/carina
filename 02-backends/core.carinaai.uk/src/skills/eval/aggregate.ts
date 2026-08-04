import type { EvalThresholds, FixtureRunResult, RunMetrics } from './types.js';
import { collectFailuresByType } from './assertions.js';

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function aggregateFixtureResults(results: FixtureRunResult[]): RunMetrics {
  const passCount = results.filter((r) => r.pass).length;
  const failCount = results.length - passCount;
  const latencies = results.map((r) => r.latencyMs);
  const tokens = results.map((r) => r.tokensUsed);

  return {
    passRate: results.length === 0 ? 0 : passCount / results.length,
    passCount,
    failCount,
    meanLatencyMs: mean(latencies),
    stdDevLatencyMs: stdDev(latencies),
    meanTokens: mean(tokens),
    stdDevTokens: stdDev(tokens),
    failuresByType: collectFailuresByType(results),
  };
}

export function checkThresholds(metrics: RunMetrics, thresholds?: EvalThresholds): boolean {
  if (!thresholds) return true;
  if (thresholds.minPassRate !== undefined && metrics.passRate < thresholds.minPassRate) {
    return false;
  }
  if (thresholds.maxMeanLatencyMs !== undefined && metrics.meanLatencyMs > thresholds.maxMeanLatencyMs) {
    return false;
  }
  if (thresholds.maxLatencyStdDevMs !== undefined && metrics.stdDevLatencyMs > thresholds.maxLatencyStdDevMs) {
    return false;
  }
  if (thresholds.maxMeanTokens !== undefined && metrics.meanTokens > thresholds.maxMeanTokens) {
    return false;
  }
  return true;
}

export function mergePassResults(
  passResults: FixtureRunResult[][],
): FixtureRunResult[] {
  const byId = new Map<string, FixtureRunResult[]>();
  for (const run of passResults) {
    for (const fr of run) {
      const list = byId.get(fr.fixtureId) ?? [];
      list.push(fr);
      byId.set(fr.fixtureId, list);
    }
  }

  const merged: FixtureRunResult[] = [];
  for (const [fixtureId, runs] of byId) {
    const passVotes = runs.filter((r) => r.pass).length;
    const pass = passVotes > runs.length / 2;
    merged.push({
      fixtureId,
      pass,
      latencyMs: mean(runs.map((r) => r.latencyMs)),
      tokensUsed: mean(runs.map((r) => r.tokensUsed)),
      matchedSkills: runs[runs.length - 1]?.matchedSkills ?? [],
      output: runs[runs.length - 1]?.output,
      assertionResults: runs[runs.length - 1]?.assertionResults ?? [],
    });
  }
  return merged.sort((a, b) => a.fixtureId.localeCompare(b.fixtureId));
}

export function compareMetrics(
  baseline: RunMetrics,
  candidate: RunMetrics,
  thresholds?: EvalThresholds,
): {
  passRateDelta: number;
  latencyDeltaMs: number;
  tokenDelta: number;
  improved: boolean;
  regression: boolean;
} {
  const passRateDelta = candidate.passRate - baseline.passRate;
  const latencyDeltaMs = candidate.meanLatencyMs - baseline.meanLatencyMs;
  const tokenDelta = candidate.meanTokens - baseline.meanTokens;
  const maxRegression = thresholds?.maxRegressionDelta ?? 0.05;

  const improved = passRateDelta > 0 || (
    passRateDelta >= 0 && latencyDeltaMs < 0
  );
  const regression = passRateDelta < -maxRegression
    || (thresholds?.maxTokenDelta !== undefined && tokenDelta > thresholds.maxTokenDelta);

  return { passRateDelta, latencyDeltaMs, tokenDelta, improved, regression };
}
