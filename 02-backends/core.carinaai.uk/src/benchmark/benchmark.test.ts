import { describe, expect, it } from 'vitest';
import { BENCHMARK_TASKS, listBenchmarkTaskIds } from './definitions.js';
import { COMPETITOR_REFERENCES } from './competitor-baselines.js';
import { generateMarkdownReport, generatePublicJson } from './report.js';
import { runPlatformBenchmark } from './runner.js';

describe('benchmark definitions', () => {
  it('has unique task ids', () => {
    const ids = listBenchmarkTaskIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all benchmark categories', () => {
    const categories = new Set(BENCHMARK_TASKS.map((t) => t.category));
    expect(categories.has('tools')).toBe(true);
    expect(categories.has('skills')).toBe(true);
    expect(categories.has('channels')).toBe(true);
    expect(categories.has('memory')).toBe(true);
    expect(categories.has('routing')).toBe(true);
    expect(categories.has('sessions')).toBe(true);
    expect(categories.has('cron')).toBe(true);
    expect(categories.has('learning')).toBe(true);
    expect(categories.has('security')).toBe(true);
    expect(categories.has('marketplace')).toBe(true);
  });

  it('scores stay within 0-100', async () => {
    for (const task of BENCHMARK_TASKS) {
      const measured = await task.measure();
      const score = task.score(measured);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('documents competitor references as published only', () => {
    for (const comp of COMPETITOR_REFERENCES) {
      expect(comp.source).toBe('published_reference');
      expect(comp.sourceNote.length).toBeGreaterThan(10);
    }
  });
});

describe('benchmark runner', () => {
  it('produces a complete report shape', async () => {
    const report = await runPlatformBenchmark();
    expect(report.runId).toMatch(/^bench-/);
    expect(report.tasks.length).toBe(BENCHMARK_TASKS.length);
    expect(report.categories.length).toBeGreaterThan(0);
    expect(report.overall.percent).toBeGreaterThan(0);
    expect(report.comparison.length).toBe(report.categories.length);
    expect(report.disclaimer).toContain('published reference');
  });

  it('generates public markdown and json', async () => {
    const report = await runPlatformBenchmark();
    const md = generateMarkdownReport(report);
    expect(md).toContain('# Carina platform benchmark report');
    expect(md).toContain('| Category | Score |');
    const pub = generatePublicJson(report);
    expect(pub.schema).toBe('carina-platform-benchmark/v1');
    expect(pub.regressionPassed).toBeTypeOf('boolean');
  });

  it('passes regression floors for closed gaps', async () => {
    const report = await runPlatformBenchmark();
    const tools = report.tasks.find((t) => t.id === 'tools.registered_count');
    const skills = report.tasks.find((t) => t.id === 'skills.builtin_count');
    const channels = report.tasks.find((t) => t.id === 'channels.catalog_count');
    expect(tools?.passedRegression).toBe(true);
    expect(skills?.passedRegression).toBe(true);
    expect(channels?.passedRegression).toBe(true);
  });
});
