import fs from 'node:fs';
import path from 'node:path';
import type { ProviderBenchmarkRunReport } from './types.js';
import { ensureBenchmarkStorage } from './definitions.js';

function providerBenchmarkBase(report: ProviderBenchmarkRunReport): string {
  return path.join(ensureBenchmarkStorage(), report.runId);
}

export function generateProviderMarkdownReport(report: ProviderBenchmarkRunReport): string {
  const lines: string[] = [];
  lines.push('# Carina provider benchmark report');
  lines.push('');
  lines.push(`Run ID: \`${report.runId}\``);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Carina version: ${report.carinaVersion}`);
  lines.push(`Host: ${report.hostname}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(`Providers tested: ${report.summary.providerCount}`);
  lines.push(`Fixtures: ${report.summary.fixtureCount}`);
  if (report.summary.topProviderId) {
    lines.push(`Top provider: ${report.summary.topProviderId} (${report.summary.topScore} weighted)`);
  }
  lines.push('');
  lines.push('## Methodology');
  lines.push('');
  lines.push(report.methodology);
  lines.push('');
  lines.push(`Note: ${report.disclaimer}`);
  lines.push('');
  lines.push('## Provider summary');
  lines.push('');
  lines.push('| Provider | Model | Score | Pass rate | Mean latency | Mean tokens | Status |');
  lines.push('|----------|-------|------:|----------:|-------------:|------------:|--------|');
  for (const provider of report.providers) {
    lines.push(
      `| ${provider.providerId} | ${provider.model} | ${provider.weightedScore} | ${Math.round(provider.passRate * 100)}% | ${provider.meanLatencyMs}ms | ${provider.meanTokens} | ${provider.status} |`,
    );
  }
  lines.push('');
  lines.push('## Fixture comparison');
  lines.push('');
  lines.push('| Fixture | Category | Provider | Score | Pass | Latency | Tokens |');
  lines.push('|---------|----------|----------|------:|------|--------:|-------:|');
  for (const fixture of report.comparison) {
    for (const row of fixture.results) {
      lines.push(
        `| ${fixture.fixtureId} | ${fixture.category} | ${row.providerId} | ${row.score} | ${row.passed ? 'PASS' : 'FAIL'} | ${row.latencyMs.toFixed(1)} | ${row.tokensUsed} |`,
      );
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function generateProviderPublicJson(report: ProviderBenchmarkRunReport): Record<string, unknown> {
  return {
    schema: 'carina-provider-benchmark/v1',
    runId: report.runId,
    generatedAt: report.generatedAt,
    carinaVersion: report.carinaVersion,
    methodology: report.methodology,
    disclaimer: report.disclaimer,
    summary: report.summary,
    providers: report.providers.map((provider) => ({
      providerId: provider.providerId,
      model: provider.model,
      status: provider.status,
      weightedScore: provider.weightedScore,
      passRate: provider.passRate,
      meanLatencyMs: provider.meanLatencyMs,
      meanTokens: provider.meanTokens,
    })),
  };
}

export function saveProviderBenchmarkReport(report: ProviderBenchmarkRunReport): {
  jsonPath: string;
  mdPath: string;
  publicJsonPath: string;
} {
  const base = providerBenchmarkBase(report);
  const jsonPath = `${base}.providers.json`;
  const mdPath = `${base}.providers.md`;
  const publicJsonPath = `${base}.providers.public.json`;
  const markdown = generateProviderMarkdownReport(report);
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(mdPath, markdown);
  fs.writeFileSync(publicJsonPath, JSON.stringify(generateProviderPublicJson(report), null, 2));
  fs.writeFileSync(path.join(ensureBenchmarkStorage(), 'latest.providers.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(ensureBenchmarkStorage(), 'latest.providers.md'), markdown);
  fs.writeFileSync(path.join(ensureBenchmarkStorage(), 'latest.providers.public.json'), JSON.stringify(generateProviderPublicJson(report), null, 2));
  return { jsonPath, mdPath, publicJsonPath };
}

export function loadProviderBenchmarkRun(runId: string): ProviderBenchmarkRunReport | null {
  const file = path.join(ensureBenchmarkStorage(), `${runId}.providers.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ProviderBenchmarkRunReport;
}

export function loadLatestProviderBenchmarkRun(): ProviderBenchmarkRunReport | null {
  const file = path.join(ensureBenchmarkStorage(), 'latest.providers.json');
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as ProviderBenchmarkRunReport;
}

export function listProviderBenchmarkRuns(limit = 20): string[] {
  const dir = ensureBenchmarkStorage();
  return fs.readdirSync(dir)
    .filter((file) => file.endsWith('.providers.json') && file.startsWith('provider-bench-'))
    .sort()
    .reverse()
    .slice(0, limit)
    .map((file) => file.replace(/\.providers\.json$/, ''));
}
