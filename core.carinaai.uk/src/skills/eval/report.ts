import fs from 'fs/promises';
import path from 'path';
import { CARINA_DATA_DIR } from '../../config/paths.js';
import type {
  BaselineComparison,
  EvalReport,
  EvalRunResult,
} from './types.js';

export const EVAL_REPORTS_DIR = path.join(CARINA_DATA_DIR, 'eval-reports');

export async function ensureReportsDir(): Promise<string> {
  await fs.mkdir(EVAL_REPORTS_DIR, { recursive: true });
  return EVAL_REPORTS_DIR;
}

export function formatRunSummary(result: EvalRunResult): string {
  const m = result.metrics;
  return [
    `Pack: ${result.pack}`,
    `Label: ${result.label}`,
    `Pass rate: ${(m.passRate * 100).toFixed(1)}% (${m.passCount}/${m.passCount + m.failCount})`,
    `Mean latency: ${m.meanLatencyMs.toFixed(2)}ms (stddev ${m.stdDevLatencyMs.toFixed(2)}ms)`,
    `Mean tokens: ${m.meanTokens.toFixed(0)} (stddev ${m.stdDevTokens.toFixed(0)})`,
    `Thresholds met: ${result.thresholdsMet ? 'yes' : 'no'}`,
  ].join('\n');
}

export function formatComparisonSummary(comparison: BaselineComparison): string {
  return [
    'Baseline vs candidate:',
    `  Pass rate delta: ${(comparison.passRateDelta * 100).toFixed(2)}%`,
    `  Latency delta: ${comparison.latencyDeltaMs.toFixed(2)}ms`,
    `  Token delta: ${comparison.tokenDelta.toFixed(0)}`,
    `  Improved: ${comparison.improved ? 'yes' : 'no'}`,
    `  Regression: ${comparison.regression ? 'yes' : 'no'}`,
    `  New failures: ${comparison.newFailures.join(', ') || 'none'}`,
    `  Fixed fixtures: ${comparison.fixedFixtures.join(', ') || 'none'}`,
  ].join('\n');
}

export function generateMarkdownReport(
  result: EvalRunResult,
  comparison?: BaselineComparison,
): string {
  const lines: string[] = [
    '# Skill Eval Report',
    '',
    `Run ID: ${result.runId}`,
    `Generated: ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    '```',
    formatRunSummary(result),
    '```',
    '',
  ];

  if (comparison) {
    lines.push('## Baseline Comparison', '', '```', formatComparisonSummary(comparison), '```', '');
  }

  if (Object.keys(result.metrics.failuresByType).length > 0) {
    lines.push('## Failures by assertion type', '');
    for (const [type, count] of Object.entries(result.metrics.failuresByType)) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');
  }

  const failing = result.fixtureResults.filter((f) => !f.pass);
  if (failing.length > 0) {
    lines.push('## Failing fixtures', '');
    for (const f of failing) {
      lines.push(`### ${f.fixtureId}`, '');
      lines.push(`Matched skills: ${f.matchedSkills.join(', ') || 'none'}`, '');
      for (const ar of f.assertionResults.filter((a) => !a.passed)) {
        lines.push(`- **${ar.assertion.type}**: ${ar.message}`);
      }
      lines.push('');
    }
  }

  lines.push('## All fixtures', '', '| Fixture | Pass | Latency (ms) | Tokens | Skills |', '| --- | --- | --- | --- | --- |');
  for (const f of result.fixtureResults) {
    lines.push(
      `| ${f.fixtureId} | ${f.pass ? 'PASS' : 'FAIL'} | ${f.latencyMs.toFixed(1)} | ${f.tokensUsed} | ${f.matchedSkills.join(', ')} |`,
    );
  }

  return lines.join('\n');
}

export async function saveReport(
  result: EvalRunResult,
  comparison?: BaselineComparison,
): Promise<EvalReport> {
  await ensureReportsDir();
  const markdown = generateMarkdownReport(result, comparison);
  const summary = formatRunSummary(result);
  const report: EvalReport = {
    runId: result.runId,
    generatedAt: new Date().toISOString(),
    summary,
    result,
    comparison,
    markdown,
  };

  const jsonPath = path.join(EVAL_REPORTS_DIR, `${result.runId}.json`);
  const mdPath = path.join(EVAL_REPORTS_DIR, `${result.runId}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
  await fs.writeFile(mdPath, markdown);

  return report;
}

export async function listRecentReports(limit = 20): Promise<EvalReport[]> {
  await ensureReportsDir();
  const entries = await fs.readdir(EVAL_REPORTS_DIR);
  const jsonFiles = entries.filter((e) => e.endsWith('.json')).sort().reverse();
  const reports: EvalReport[] = [];
  for (const file of jsonFiles.slice(0, limit)) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(EVAL_REPORTS_DIR, file), 'utf8')) as EvalReport;
      reports.push(raw);
    } catch {
      // skip corrupt
    }
  }
  return reports;
}

export async function loadReport(runId: string): Promise<EvalReport | null> {
  const jsonPath = path.join(EVAL_REPORTS_DIR, `${runId}.json`);
  try {
    return JSON.parse(await fs.readFile(jsonPath, 'utf8')) as EvalReport;
  } catch {
    return null;
  }
}
