import type { BenchmarkMeasureResult } from './types.js';

export function scoreCount(observed: number, target: number, floor = 0): number {
  if (observed >= target) return 100;
  if (target <= floor) return observed > 0 ? 100 : 0;
  const ratio = (observed - floor) / (target - floor);
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

export function scoreBoolean(passed: boolean): number {
  return passed ? 100 : 0;
}

export function scoreFromMeasure(
  result: BenchmarkMeasureResult,
  target: number,
  floor = 0,
): number {
  if (typeof result.observed === 'boolean') return scoreBoolean(result.observed);
  if (typeof result.observed === 'number') return scoreCount(result.observed, target, floor);
  return 0;
}

export function weightedAverage(
  items: Array<{ score: number; weight: number }>,
): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return 0;
  const weighted = items.reduce((sum, item) => sum + item.score * item.weight, 0);
  return Math.round((weighted / totalWeight) * 10) / 10;
}
