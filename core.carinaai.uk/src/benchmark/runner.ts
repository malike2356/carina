import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BENCHMARK_TASKS } from './definitions.js';
import { COMPETITOR_REFERENCES } from './competitor-baselines.js';
import { weightedAverage } from './scorer.js';
import type {
  BenchmarkCategory,
  BenchmarkCategorySummary,
  BenchmarkRunReport,
  BenchmarkTaskResult,
} from './types.js';

function readCarinaVersion(): string {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const pkgPath = path.resolve(here, '../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { version?: string };
    return pkg.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function newRunId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `bench-${stamp}`;
}

function summarizeCategories(tasks: BenchmarkTaskResult[]): BenchmarkCategorySummary[] {
  const byCategory = new Map<BenchmarkCategory, BenchmarkTaskResult[]>();
  for (const task of tasks) {
    const list = byCategory.get(task.category) ?? [];
    list.push(task);
    byCategory.set(task.category, list);
  }
  return [...byCategory.entries()].map(([category, rows]) => ({
    category,
    taskCount: rows.length,
    weightedScore: weightedAverage(rows.map((r) => ({ score: r.score, weight: r.weight }))),
    maxScore: 100,
  }));
}

function categoryScoreMap(categories: BenchmarkCategorySummary[]): Map<BenchmarkCategory, number> {
  return new Map(categories.map((c) => [c.category, c.weightedScore]));
}

export async function runPlatformBenchmark(): Promise<BenchmarkRunReport> {
  const taskResults: BenchmarkTaskResult[] = [];

  for (const task of BENCHMARK_TASKS) {
    const measured = await task.measure();
    const score = Math.max(0, Math.min(100, Math.round(task.score(measured))));
    const observed = measured.observed;
    const regressionMin = task.regressionMin;
    const passedRegression = regressionMin == null
      ? true
      : typeof observed === 'number'
        ? observed >= regressionMin
        : score >= regressionMin;

    taskResults.push({
      id: task.id,
      category: task.category,
      title: task.title,
      weight: task.weight,
      observed,
      unit: measured.unit,
      detail: measured.detail,
      score,
      passedRegression,
      regressionMin,
      metadata: measured.metadata,
    });
  }

  const categories = summarizeCategories(taskResults);
  const catScores = categoryScoreMap(categories);
  const overallWeighted = weightedAverage(
    taskResults.map((t) => ({ score: t.score, weight: t.weight })),
  );
  const failedRegressionTasks = taskResults
    .filter((t) => !t.passedRegression)
    .map((t) => t.id);

  const comparison = categories.map((row) => {
    const sample = taskResults.find((t) => t.category === row.category && typeof t.observed === 'number');
    return {
      category: row.category,
      carinaScore: row.weightedScore,
      carinaObserved: sample?.observed,
      references: COMPETITOR_REFERENCES.map((comp) => {
        const ref = comp.dimensions[row.category] ?? null;
        return {
          competitorId: comp.id,
          label: comp.label,
          referenceScore: ref,
          delta: ref == null ? null : Math.round((row.weightedScore - ref) * 10) / 10,
        };
      }),
    };
  });

  return {
    runId: newRunId(),
    generatedAt: new Date().toISOString(),
    carinaVersion: readCarinaVersion(),
    hostname: os.hostname(),
    methodology:
      'Static capability probes against the installed Carina kernel. No LLM calls. Identical tasks every run.',
    disclaimer:
      'Competitor columns are published reference scores, not live measurements from this harness. '
      + 'Use Carina task scores for defensible product claims.',
    tasks: taskResults,
    categories,
    overall: {
      weightedScore: overallWeighted,
      maxScore: 100,
      percent: overallWeighted,
      regressionPassed: failedRegressionTasks.length === 0,
      failedRegressionTasks,
    },
    competitors: COMPETITOR_REFERENCES,
    comparison,
  };
}

export function assertBenchmarkRegression(report: BenchmarkRunReport): void {
  if (!report.overall.regressionPassed) {
    throw new Error(
      `Benchmark regression failed: ${report.overall.failedRegressionTasks.join(', ')}`,
    );
  }
}
