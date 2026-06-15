import fs from 'node:fs';
import path from 'node:path';
import type { BenchmarkRunReport } from './types.js';
import { ensureBenchmarkStorage } from './definitions.js';

export function generateMarkdownReport(report: BenchmarkRunReport): string {
  const lines: string[] = [];
  lines.push('# Carina platform benchmark report');
  lines.push('');
  lines.push(`Run ID: \`${report.runId}\``);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Carina version: ${report.carinaVersion}`);
  lines.push(`Host: ${report.hostname}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`Overall score: **${report.overall.percent}%** (${report.overall.weightedScore}/100 weighted)`);
  lines.push(`Regression: ${report.overall.regressionPassed ? 'PASS' : 'FAIL'}`);
  if (!report.overall.regressionPassed) {
    lines.push(`Failed tasks: ${report.overall.failedRegressionTasks.join(', ')}`);
  }
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push(report.methodology);
  lines.push('');
  lines.push(`Note: ${report.disclaimer}`);
  lines.push('');
  lines.push('## Category scores (measured)');
  lines.push('');
  lines.push('| Category | Score | Tasks |');
  lines.push('|----------|------:|------:|');
  for (const row of report.categories) {
    lines.push(`| ${row.category} | ${row.weightedScore} | ${row.taskCount} |`);
  }
  lines.push('');
  lines.push('## Comparison vs published references');
  lines.push('');
  lines.push('| Category | Carina (measured) | Hermes (ref) | OpenClaw (ref) | Odysseus (ref) |');
  lines.push('|----------|------------------:|-------------:|---------------:|---------------:|');
  for (const row of report.comparison) {
    const refs = Object.fromEntries(row.references.map((r) => [r.competitorId, r.referenceScore ?? '-']));
    lines.push(
      `| ${row.category} | ${row.carinaScore} | ${refs.hermes ?? '-'} | ${refs.openclaw ?? '-'} | ${refs.odysseus ?? '-'} |`,
    );
  }
  lines.push('');
  lines.push('## Task results');
  lines.push('');
  lines.push('| Task | Category | Observed | Score | Regression |');
  lines.push('|------|----------|----------|------:|------------|');
  for (const task of report.tasks) {
    const observed = typeof task.observed === 'boolean'
      ? (task.observed ? 'yes' : 'no')
      : String(task.observed);
    lines.push(
      `| ${task.id} | ${task.category} | ${observed}${task.unit ? ` ${task.unit}` : ''} | ${task.score} | ${task.passedRegression ? 'ok' : 'FAIL'} |`,
    );
  }
  lines.push('');
  lines.push('## Competitor reference sources');
  lines.push('');
  for (const comp of report.competitors) {
    lines.push(`- **${comp.label}** (${comp.asOf}): ${comp.sourceNote}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function generatePublicJson(report: BenchmarkRunReport): Record<string, unknown> {
  return {
    schema: 'carina-platform-benchmark/v1',
    runId: report.runId,
    generatedAt: report.generatedAt,
    carinaVersion: report.carinaVersion,
    overallPercent: report.overall.percent,
    regressionPassed: report.overall.regressionPassed,
    categories: report.categories,
    comparison: report.comparison,
    disclaimer: report.disclaimer,
    competitors: report.competitors.map((c) => ({
      id: c.id,
      label: c.label,
      source: c.source,
      asOf: c.asOf,
    })),
  };
}

export function saveBenchmarkReport(
  report: BenchmarkRunReport,
  outDir?: string,
): { jsonPath: string; mdPath: string; publicJsonPath: string } {
  const dir = outDir ?? ensureBenchmarkStorage();
  fs.mkdirSync(dir, { recursive: true });
  const base = path.join(dir, report.runId);
  const jsonPath = `${base}.json`;
  const mdPath = `${base}.md`;
  const publicJsonPath = `${base}.public.json`;
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, generateMarkdownReport(report));
  fs.writeFileSync(publicJsonPath, JSON.stringify(generatePublicJson(report), null, 2));
  fs.writeFileSync(path.join(dir, 'latest.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(dir, 'latest.md'), generateMarkdownReport(report));
  fs.writeFileSync(path.join(dir, 'latest.public.json'), JSON.stringify(generatePublicJson(report), null, 2));
  return { jsonPath, mdPath, publicJsonPath };
}

export function listBenchmarkRuns(limit = 20): string[] {
  const dir = ensureBenchmarkStorage();
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f.startsWith('bench-') && !f.includes('.public.'))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((f) => f.replace(/\.json$/, ''));
}

export function loadBenchmarkRun(runId: string): BenchmarkRunReport | null {
  const dir = ensureBenchmarkStorage();
  const file = path.join(dir, `${runId}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as BenchmarkRunReport;
}
