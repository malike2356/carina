import { spawnSync } from 'node:child_process';
import {
  parseNpmAuditReport,
} from '../automated-review/dependency-scan.js';
import type { DependencyFinding, DependencyScanReport } from './types.js';

function summarize(findings: DependencyFinding[]): DependencyScanReport['summary'] {
  return findings.reduce((acc, row) => {
    acc[row.severity] += 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
}

function determineVerdict(summary: DependencyScanReport['summary']): DependencyScanReport['verdict'] {
  if (summary.critical > 0) return 'blocked';
  if (summary.high > 0) return 'warning';
  return 'clean';
}

export function defaultAuditRunner(cwd: string): () => Promise<{ stdout: string; stderr: string; status: number | null }> {
  return async () => {
    const result = spawnSync('pnpm', ['audit', '--json'], { cwd, encoding: 'utf8' });
    return {
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      status: result.status,
    };
  };
}

export async function scanDependencies(
  projectRoot: string,
  runAudit: () => Promise<{ stdout: string; stderr: string; status: number | null }> = defaultAuditRunner(projectRoot),
): Promise<DependencyScanReport> {
  const result = await runAudit();
  let findings: DependencyFinding[] = [];

  if (result.status === 0) {
    findings = [];
  } else {
    const payload = `${result.stdout}\n${result.stderr}`.trim();
    if (!payload) {
      findings = [{
        id: 'dependency:audit-failed',
        severity: 'high',
        module: 'pnpm-audit',
        title: 'Dependency audit failed',
        recommendation: 'Run pnpm audit locally and resolve reported vulnerabilities.',
      }];
    } else {
      try {
        const jsonStart = payload.indexOf('{');
        const json = JSON.parse(payload.slice(jsonStart)) as Parameters<typeof parseNpmAuditReport>[0];
        findings = parseNpmAuditReport(json).map((row) => ({
          id: row.id,
          severity: row.severity,
          module: row.description.split(':').pop()?.trim() ?? 'unknown',
          title: row.description,
          url: row.recommendation.startsWith('Review advisory') ? row.recommendation.split(': ').pop() : undefined,
          recommendation: row.recommendation,
        }));
      } catch {
        findings = [{
          id: 'dependency:audit-unparsed',
          severity: 'medium',
          module: 'pnpm-audit',
          title: 'Dependency audit reported issues',
          recommendation: 'Run pnpm audit and inspect output manually.',
        }];
      }
    }
  }

  const summary = summarize(findings);
  return {
    scannedAt: new Date().toISOString(),
    projectRoot,
    findings,
    summary,
    verdict: determineVerdict(summary),
  };
}

export function formatDependencyScanSummary(report: DependencyScanReport): string {
  return [
    `Dependency scan: ${report.verdict}`,
    `Findings: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low`,
  ].join('\n');
}

export function shouldBlockDependencyScan(
  report: DependencyScanReport,
  failOn: 'critical' | 'high' = 'critical',
): boolean {
  if (failOn === 'critical') return report.summary.critical > 0;
  return report.summary.critical > 0 || report.summary.high > 0;
}

export async function runDependencyAudit(projectRoot: string): Promise<DependencyScanReport> {
  const scan = await scanDependencies(projectRoot);
  return scan;
}
