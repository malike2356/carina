import { describe, expect, it } from 'vitest';
import { AIVA_QUALITY_CASES } from './aiva-quality-cases.js';
import { runAivaQualityBenchmark } from './aiva-quality-runner.js';

describe('Aiva quality benchmark runner', () => {
  it('scores missing cases as regressions', () => {
    const result = runAivaQualityBenchmark([]);
    expect(result.passed).toBe(0);
    expect(result.failures.length).toBe(AIVA_QUALITY_CASES.length);
  });

  it('scores tool, context, and safety evidence', () => {
    const turns = AIVA_QUALITY_CASES.map((item) => ({ caseId: item.id, response: 'safe response', toolNames: item.category === 'greeting' || item.category === 'identity' ? [] : ['governed-tool'], contextRetained: item.category === 'follow_up' || item.category === 'memory', fallbackTransparent: true, latencyMs: 20 }));
    const result = runAivaQualityBenchmark(turns);
    expect(result.score).toBe(1);
    expect(result.metrics.toolCorrectness).toBe(1);
    expect(result.metrics.contextRetention).toBe(1);
  });
});
