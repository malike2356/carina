import { readSecurityAuditTail } from '../security-audit.js';
import { buildSecurityTrustState } from '../trust-state.js';
import {
  complianceCollector,
  collectAllFrameworks,
} from '../compliance/collector.js';
import type { ComplianceFrameworkId, ComplianceReport, EvidenceItem } from '../compliance/types.js';
import { syncComplianceReportToScout } from '../compliance/scout-sync.js';
import { isScoutMutualIntegrationActive } from '../scout-mode.js';

export type OperationalEvidenceBundle = {
  collectedAt: string;
  auditTrail: ReturnType<typeof readSecurityAuditTail>;
  trustState: Awaited<ReturnType<typeof buildSecurityTrustState>>;
  toolUsageSummary: {
    auditEntries: number;
    blockedActions: number;
    attestationEvents: number;
  };
};

const FRAMEWORKS: ComplianceFrameworkId[] = ['soc2', 'iso27001', 'gdpr'];

export async function collectOperationalEvidence(): Promise<OperationalEvidenceBundle> {
  const auditTrail = readSecurityAuditTail(50);
  const trustState = await buildSecurityTrustState();
  return {
    collectedAt: new Date().toISOString(),
    auditTrail,
    trustState,
    toolUsageSummary: {
      auditEntries: auditTrail.length,
      blockedActions: auditTrail.filter((row) => row.action === 'block').length,
      attestationEvents: auditTrail.filter((row) => row.category === 'attestation').length,
    },
  };
}

function attachOperationalEvidence(report: ComplianceReport, bundle: OperationalEvidenceBundle): ComplianceReport {
  const expiresAt = Date.now() + 30 * 86_400_000;
  const operationalItems: EvidenceItem[] = [
    {
      type: 'attestation',
      description: 'Trust state snapshot',
      source: 'security/trust-state.ts',
      value: {
        suspended: bundle.trustState.suspended,
        sandboxPolicyMode: bundle.trustState.sandboxPolicyMode,
        scoutPolicyEvaluate: bundle.trustState.availability.scoutPolicyEvaluate,
      },
      collectedAt: Date.now(),
      expiresAt,
    },
    {
      type: 'log',
      description: 'Security audit trail (metadata only)',
      source: 'security/security-audit.ts',
      value: {
        entries: bundle.auditTrail.length,
        blocked: bundle.toolUsageSummary.blockedActions,
      },
      collectedAt: Date.now(),
      expiresAt,
    },
    {
      type: 'log',
      description: 'Tool usage statistics',
      source: 'security/security-audit.ts',
      value: bundle.toolUsageSummary,
      collectedAt: Date.now(),
      expiresAt,
    },
  ];

  const evidence = report.evidence.map((row: ComplianceReport['evidence'][number]) => {
    if (row.evidence.length > 0) return row;
    return {
      ...row,
      evidence: operationalItems.slice(0, 1),
      status: row.status,
    };
  });

  return { ...report, evidence };
}

export async function collectFrameworkEvidence(
  frameworkId: ComplianceFrameworkId,
): Promise<ComplianceReport> {
  const bundle = await collectOperationalEvidence();
  const report = await complianceCollector.collect(frameworkId);
  return attachOperationalEvidence(report, bundle);
}

export async function collectAllFrameworkEvidence(): Promise<ComplianceReport[]> {
  const bundle = await collectOperationalEvidence();
  const reports = await collectAllFrameworks();
  return reports.map((report) => attachOperationalEvidence(report, bundle));
}

export async function syncAllFrameworkEvidenceToScout(): Promise<{
  frameworks: ComplianceFrameworkId[];
  inserted: number;
  errors: string[];
}> {
  if (!isScoutMutualIntegrationActive()) {
    return { frameworks: [], inserted: 0, errors: ['Scout integration disabled'] };
  }

  const reports = await collectAllFrameworkEvidence();
  let inserted = 0;
  const errors: string[] = [];

  for (const report of reports) {
    try {
      const result = await syncComplianceReportToScout(report);
      inserted += result.inserted;
      errors.push(...result.errors);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${report.framework.id}: ${msg}`);
    }
  }

  return { frameworks: FRAMEWORKS, inserted, errors };
}

export async function remediateStaleEvidenceIfNeeded(): Promise<number> {
  let remediated = 0;
  for (const frameworkId of FRAMEWORKS) {
    const report = await complianceCollector.collect(frameworkId);
    const gaps = report.gapAnalysis.filter((gap) => gap.severity === 'fail');
    if (gaps.length === 0) continue;
    await collectFrameworkEvidence(frameworkId);
    remediated += gaps.length;
  }
  return remediated;
}
