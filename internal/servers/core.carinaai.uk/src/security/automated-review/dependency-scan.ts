import type { SecurityFinding } from './types.js';

type AuditAdvisory = {
  severity?: string;
  title?: string;
  module_name?: string;
  url?: string;
};

type AuditReport = {
  advisories?: Record<string, AuditAdvisory>;
  metadata?: { vulnerabilities?: { high?: number; critical?: number; moderate?: number; low?: number } };
};

function mapAuditSeverity(raw: string | undefined): SecurityFinding['severity'] {
  switch ((raw ?? '').toLowerCase()) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'moderate':
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

export function parseNpmAuditReport(report: AuditReport): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const advisories = report.advisories ?? {};

  for (const [id, advisory] of Object.entries(advisories)) {
    findings.push({
      id: `dependency:${id}`,
      severity: mapAuditSeverity(advisory.severity),
      category: 'dependency',
      file: 'package.json',
      line: 0,
      description: advisory.title ?? `Vulnerable dependency: ${advisory.module_name ?? id}`,
      recommendation: advisory.url
        ? `Review advisory and upgrade: ${advisory.url}`
        : 'Run pnpm audit and upgrade affected packages.',
      autoFixable: false,
    });
  }

  return findings;
}

export async function runDependencyScan(
  runAudit: () => Promise<{ stdout: string; stderr: string; status: number | null }>,
): Promise<SecurityFinding[]> {
  const result = await runAudit();
  if (result.status === 0) return [];

  const payload = `${result.stdout}\n${result.stderr}`.trim();
  if (!payload) {
    return [{
      id: 'dependency:audit-failed',
      severity: 'high',
      category: 'dependency',
      file: 'package.json',
      line: 0,
      description: 'Dependency audit failed',
      recommendation: 'Run pnpm audit locally and resolve reported vulnerabilities.',
      autoFixable: false,
    }];
  }

  try {
    const jsonStart = payload.indexOf('{');
    const json = JSON.parse(payload.slice(jsonStart)) as AuditReport;
    return parseNpmAuditReport(json);
  } catch {
    return [{
      id: 'dependency:audit-unparsed',
      severity: 'medium',
      category: 'dependency',
      file: 'package.json',
      line: 0,
      description: 'Dependency audit reported issues',
      recommendation: 'Run pnpm audit:security locally and inspect output.',
      autoFixable: false,
    }];
  }
}
