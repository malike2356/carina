import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ComplianceDashboard,
  ComplianceEvidence,
  ComplianceFrameworkId,
  ComplianceGap,
  ComplianceReport,
  ComplianceStatus,
} from './types.js';
import { getControls, getFramework } from './controls.js';
import { collectEvidenceForControl } from './evidence-sources.js';
import { complianceRoot, lastCollectionPath, reportsDir } from './paths.js';

const COLLECTION_INTERVAL_MS = 30 * 86_400_000;

export class ComplianceCollector {
  getControls(framework: ComplianceFrameworkId) {
    return getControls(framework);
  }

  async collect(frameworkId: ComplianceFrameworkId): Promise<ComplianceReport> {
    const framework = getFramework(frameworkId);
    const controls = this.getControls(frameworkId);
    const evidence: ComplianceEvidence[] = [];
    const now = Date.now();

    for (const control of controls) {
      const result = await collectEvidenceForControl(control.collectorId, now);
      const items = result.items.map((item, index) => {
        if (index !== 0 || !result.detail) return item;
        return {
          ...item,
          value: typeof item.value === 'object' && item.value !== null
            ? { ...(item.value as Record<string, unknown>), detail: result.detail }
            : { value: item.value, detail: result.detail },
        };
      });
      evidence.push({
        framework: frameworkId,
        controlId: control.id,
        controlName: control.name,
        status: this.assessStatus(result.compliant, result.items.length),
        evidence: items,
        lastCollected: now,
        nextCollection: now + COLLECTION_INTERVAL_MS,
      });
    }

    const report: ComplianceReport = {
      framework,
      evidence,
      generatedAt: new Date(now).toISOString(),
      overallStatus: this.computeOverallStatus(evidence),
      scorePercent: this.computeScorePercent(evidence),
      gapAnalysis: this.generateGapAnalysis(frameworkId, evidence),
    };

    await saveComplianceReport(report);
    await updateLastCollection(frameworkId, now);

    if (frameworkId === 'soc2') {
      try {
        const { scoutComplianceSyncEnabled, syncComplianceReportToScout } = await import('./scout-sync.js');
        if (scoutComplianceSyncEnabled()) {
          const syncResult = await syncComplianceReportToScout(report);
          if (syncResult.inserted > 0) {
            console.log(
              `[compliance] synced ${syncResult.inserted} evidence row(s) to Scout (${syncResult.controlsTouched.length} controls)`,
            );
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[compliance] Scout evidence sync skipped: ${message}`);
      }
    }

    return report;
  }

  assessStatus(compliant: boolean, itemCount: number): ComplianceStatus {
    if (itemCount === 0) return 'non_compliant';
    return compliant ? 'compliant' : 'non_compliant';
  }

  computeOverallStatus(evidence: ComplianceEvidence[]): ComplianceStatus {
    if (evidence.length === 0) return 'non_compliant';
    const fails = evidence.filter((row) => row.status === 'non_compliant').length;
    if (fails === 0) return 'compliant';
    if (fails <= Math.ceil(evidence.length * 0.15)) return 'compliant';
    return 'non_compliant';
  }

  computeScorePercent(evidence: ComplianceEvidence[]): number {
    if (evidence.length === 0) return 0;
    const pass = evidence.filter((row) => row.status === 'compliant').length;
    return Math.round((pass / evidence.length) * 100);
  }

  generateGapAnalysis(
    frameworkId: ComplianceFrameworkId,
    evidence: ComplianceEvidence[],
  ): ComplianceGap[] {
    const gaps: ComplianceGap[] = [];
    for (const row of evidence) {
      if (row.status !== 'non_compliant') continue;
      const value = row.evidence[0]?.value as Record<string, unknown> | undefined;
      let detail = `Control ${row.controlId} failed evidence collection`;
      if (typeof value?.detail === 'string' && value.detail) {
        detail = value.detail;
      } else if (value?.compliant === false && !value?.lastRunAt) {
        detail = 'No penetration test run recorded';
      } else if (value?.verdict === 'blocked') {
        detail = 'Dependency or supply chain scan blocked';
      }
      gaps.push({
        framework: frameworkId,
        controlId: row.controlId,
        controlName: row.controlName,
        severity: row.controlId.includes('pentest') || row.controlId.includes('cc8') ? 'warn' : 'fail',
        detail,
        remediation: remediationForControl(row.controlId),
      });
    }
    return gaps;
  }
}

function remediationForControl(controlId: string): string | undefined {
  if (controlId.includes('pentest') || controlId.includes('a.12.6')) {
    return 'Run: carina security pentest --critical';
  }
  if (controlId.includes('cc7.1') || controlId.includes('a.14.2')) {
    return 'Run: carina security review on changed paths before merge';
  }
  if (controlId.includes('cc6.7') || controlId.includes('rotation')) {
    return 'Run: carina security secrets rotate <provider>';
  }
  if (controlId.includes('art30') || controlId.includes('art6')) {
    return 'Update data processing registry under compliance/data-registry.json';
  }
  return undefined;
}

export const complianceCollector = new ComplianceCollector();

export async function collectAllFrameworks(): Promise<ComplianceReport[]> {
  const ids: ComplianceFrameworkId[] = ['soc2', 'iso27001', 'gdpr'];
  const reports: ComplianceReport[] = [];
  for (const id of ids) {
    reports.push(await complianceCollector.collect(id));
  }
  return reports;
}

export async function buildComplianceDashboard(
  reports?: ComplianceReport[],
): Promise<ComplianceDashboard> {
  const resolved = reports ?? await collectAllFrameworks();
  const frameworks = resolved.map((report) => ({
    id: report.framework.id,
    name: report.framework.name,
    scorePercent: report.scorePercent,
    compliant: report.evidence.filter((row) => row.status === 'compliant').length,
    total: report.evidence.length,
  }));
  const gaps = resolved.flatMap((report) => report.gapAnalysis);
  const overallScore = frameworks.length === 0
    ? 0
    : Math.round(frameworks.reduce((sum, row) => sum + row.scorePercent, 0) / frameworks.length);
  const overallStatus: ComplianceStatus = gaps.some((row) => row.severity === 'fail')
    ? 'non_compliant'
    : gaps.length > 0
      ? 'compliant'
      : 'compliant';

  let lastCollectionAt: string | undefined;
  let nextScheduledAt: string | undefined;
  try {
    const meta = JSON.parse(await fs.readFile(lastCollectionPath(), 'utf8')) as {
      lastCollectedAt?: string;
      nextScheduledAt?: string;
    };
    lastCollectionAt = meta.lastCollectedAt;
    nextScheduledAt = meta.nextScheduledAt;
  } catch {
    // ignore
  }

  return {
    generatedAt: new Date().toISOString(),
    overallStatus,
    overallScorePercent: overallScore,
    frameworks,
    gaps,
    lastCollectionAt,
    nextScheduledAt,
  };
}

export async function saveComplianceReport(report: ComplianceReport): Promise<string> {
  const dir = reportsDir();
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${report.framework.id}-${Date.now()}.json`);
  await fs.writeFile(filePath, JSON.stringify(report, null, 2), { mode: 0o600 });
  return filePath;
}

async function updateLastCollection(frameworkId: ComplianceFrameworkId, now: number): Promise<void> {
  const filePath = lastCollectionPath();
  let meta: Record<string, unknown> = {};
  try {
    meta = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  } catch {
    meta = {};
  }
  meta.lastCollectedAt = new Date(now).toISOString();
  meta.nextScheduledAt = new Date(now + COLLECTION_INTERVAL_MS).toISOString();
  meta[`lastCollected_${frameworkId}`] = new Date(now).toISOString();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(meta, null, 2), { mode: 0o600 });
}

export async function loadLatestReport(frameworkId: ComplianceFrameworkId): Promise<ComplianceReport | null> {
  const dir = reportsDir();
  try {
    const files = (await fs.readdir(dir))
      .filter((name) => name.startsWith(`${frameworkId}-`) && name.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return JSON.parse(await fs.readFile(path.join(dir, files[0]!), 'utf8')) as ComplianceReport;
  } catch {
    return null;
  }
}

export async function _resetComplianceStoreForTests(): Promise<void> {
  try {
    await fs.rm(complianceRoot(), { recursive: true, force: true });
  } catch {
    // ignore
  }
}

export function formatComplianceDashboard(dashboard: ComplianceDashboard): string {
  const lines = [
    'COMPLIANCE DASHBOARD',
    '',
    `Overall Status: ${dashboard.overallStatus.toUpperCase()} (${dashboard.overallScorePercent}% controls pass)`,
    '',
  ];
  for (const row of dashboard.frameworks) {
    const bar = '#'.repeat(Math.round(row.scorePercent / 5)).padEnd(20, '.');
    lines.push(`  ${row.id.padEnd(10)} ${bar}  ${row.scorePercent}% (${row.compliant}/${row.total})`);
  }
  if (dashboard.gaps.length > 0) {
    lines.push('', 'Gaps:');
    for (const gap of dashboard.gaps.slice(0, 10)) {
      lines.push(`  [${gap.severity.toUpperCase()}] ${gap.controlId}: ${gap.controlName}`);
      lines.push(`      ${gap.detail}`);
      if (gap.remediation) lines.push(`      Remediation: ${gap.remediation}`);
    }
  }
  if (dashboard.lastCollectionAt) {
    lines.push('', `Last evidence collection: ${dashboard.lastCollectionAt}`);
  }
  if (dashboard.nextScheduledAt) {
    lines.push(`Next scheduled: ${dashboard.nextScheduledAt}`);
  }
  return lines.join('\n');
}

export function formatComplianceReport(report: ComplianceReport): string {
  const lines = [
    `${report.framework.name} compliance report`,
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.overallStatus} (${report.scorePercent}%)`,
    '',
  ];
  for (const row of report.evidence) {
    lines.push(`  [${row.status}] ${row.controlId} ${row.controlName}`);
  }
  if (report.gapAnalysis.length > 0) {
    lines.push('', 'Gap analysis:');
    for (const gap of report.gapAnalysis) {
      lines.push(`  - ${gap.controlId}: ${gap.detail}`);
    }
  }
  return lines.join('\n');
}

export function shouldBlockComplianceGaps(
  dashboard: ComplianceDashboard,
  failOn: 'warn' | 'fail' = 'fail',
): boolean {
  if (failOn === 'warn') {
    return dashboard.gaps.length > 0;
  }
  return dashboard.gaps.some((row) => row.severity === 'fail');
}
