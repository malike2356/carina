import { pool } from '../db.js';
import { buildPublicTrustFromDb } from './build-public-trust.js';
import { buildTrustHistory } from './trust-history.js';
import { mapEventToIncident } from './incident-types.js';
import { generateGdprReport } from '../audit/compliance/gdpr-report.js';

export interface ComplianceFrameworkSection {
  framework: 'SOC2' | 'ISO27001' | 'EU_AI_ACT';
  status: 'ready' | 'partial' | 'planned';
  controls: Array<{ id: string; title: string; evidence: string; status: string }>;
}

export interface EnterpriseComplianceReport {
  generated_at: string;
  report_version: 1;
  provider: 'labyrinth-scout';
  trust: Awaited<ReturnType<typeof buildPublicTrustFromDb>>;
  history: Awaited<ReturnType<typeof buildTrustHistory>>;
  gdpr: Awaited<ReturnType<typeof generateGdprReport>>;
  incidents_30d: ReturnType<typeof mapEventToIncident>[];
  frameworks: ComplianceFrameworkSection[];
}

export async function buildEnterpriseComplianceReport(
  slug = 'carina-reference',
): Promise<EnterpriseComplianceReport> {
  const [trust, history, gdpr, incidents] = await Promise.all([
    buildPublicTrustFromDb(),
    buildTrustHistory(slug),
    generateGdprReport(),
    pool.query<{
      id: string;
      severity: string;
      event_type: string;
      description: string;
      instance_id: string | null;
      session_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, severity, event_type, description, instance_id, session_id, created_at
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '30 days'
         AND severity IN ('warning', 'critical', 'breach')
       ORDER BY created_at DESC
       LIMIT 100`,
    ),
  ]);

  const classified = incidents.rows.map(mapEventToIncident);
  const type3Count = classified.filter((item) => item.incident_type === 'type3').length;
  const monitoringLive = trust.monitoring.scout_active;

  return {
    generated_at: new Date().toISOString(),
    report_version: 1,
    provider: 'labyrinth-scout',
    trust,
    history,
    gdpr,
    incidents_30d: classified,
    frameworks: [
      {
        framework: 'SOC2',
        status: monitoringLive ? 'partial' : 'planned',
        controls: [
          {
            id: 'CC7.2',
            title: 'Security event monitoring',
            evidence: `${trust.metrics.events_today} events logged today; Scout ${monitoringLive ? 'active' : 'idle'}`,
            status: monitoringLive ? 'evidence_available' : 'monitoring_required',
          },
          {
            id: 'CC7.3',
            title: 'Incident response',
            evidence: `${classified.length} classified incidents in 30d; kill switch + forensic snapshots enabled`,
            status: 'evidence_available',
          },
        ],
      },
      {
        framework: 'ISO27001',
        status: 'partial',
        controls: [
          {
            id: 'A.12.4.1',
            title: 'Event logging',
            evidence: 'Immutable audit_log + security_events with retention policy',
            status: 'evidence_available',
          },
          {
            id: 'A.16.1',
            title: 'Incident management',
            evidence: `Type 3 incidents tracked: ${type3Count} in 30d`,
            status: type3Count === 0 ? 'no_incidents' : 'review_required',
          },
        ],
      },
      {
        framework: 'EU_AI_ACT',
        status: trust.verification ? 'partial' : 'planned',
        controls: [
          {
            id: 'Art.15',
            title: 'Accuracy and robustness',
            evidence: `Injection blocks 24h: ${trust.metrics.injection_blocks_24h}`,
            status: 'evidence_available',
          },
          {
            id: 'Art.17',
            title: 'Logging and traceability',
            evidence: trust.verification
              ? `ERC-8126 unified risk ${trust.verification.unified_risk_score}/100`
              : 'ERC-8126 verification pending wallet setup',
            status: trust.verification ? 'evidence_available' : 'on_chain_pending',
          },
        ],
      },
    ],
  };
}

export function complianceReportToPdfLines(report: EnterpriseComplianceReport): string[] {
  const lines = [
    'Labyrinth Scout Enterprise Compliance Report',
    `Generated: ${report.generated_at}`,
    '',
    `Risk score: ${report.trust.risk_score}/100 (${report.trust.risk_tier_label})`,
    `Agents protected: ${report.trust.monitoring.agents_protected}`,
    `Runtime incidents 30d: ${report.trust.metrics.runtime_incidents_30d}`,
    `Attestations on record: ${report.history.attestations.length}`,
    `ERC-8126 verifications: ${report.history.verifications.length}`,
    '',
    'Framework readiness:',
  ];

  for (const framework of report.frameworks) {
    lines.push(`- ${framework.framework}: ${framework.status}`);
    for (const control of framework.controls) {
      lines.push(`  ${control.id} ${control.title}: ${control.status}`);
    }
  }

  lines.push('');
  lines.push(`Classified incidents (30d): ${report.incidents_30d.length}`);
  return lines;
}
