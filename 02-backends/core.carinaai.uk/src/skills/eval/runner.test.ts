import { describe, expect, it } from 'vitest';
import { runEval } from './runner.js';
import { generateMarkdownReport } from './report.js';

describe('eval runner integration', () => {
  it('runs productivity pack eval fixtures offline', async () => {
    const result = await runEval({
      packOrPath: 'productivity',
      label: 'ci',
      passes: 1,
    });
    expect(result.pack).toBe('productivity');
    expect(result.fixtureResults.length).toBeGreaterThan(0);
    expect(result.metrics.meanLatencyMs).toBeLessThan(100);
    const md = generateMarkdownReport(result);
    expect(md).toContain('productivity');
  });

  it('meets productivity thresholds', async () => {
    const result = await runEval({ packOrPath: 'productivity', passes: 1 });
    expect(result.metrics.passRate).toBeGreaterThanOrEqual(0.9);
    expect(result.thresholdsMet).toBe(true);
  });
});
