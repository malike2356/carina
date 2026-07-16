import { pool } from '../db.js';
import { hasComplianceEvidenceTable } from './table-check.js';
import type { ComplianceScore, ControlCoverage, ScoutCombinedScore, TrendPoint } from './types.js';

const DEFAULT_TOTAL_CONTROLS = 31;

interface ControlRow {
  control_id: string;
  name: string;
  criteria_group: string;
  evidence_count: string;
  last_evidence_at: string | null;
}

function getGapAction(controlId: string): ControlCoverage['gapAction'] {
  const gapMap: Record<string, NonNullable<ControlCoverage['gapAction']>> = {
    'CC6.1': { description: 'SSO integration not configured', actionType: 'configure_sso', actionUrl: '/settings/sso' },
    'CC6.2': { description: 'SSO integration not configured', actionType: 'configure_sso', actionUrl: '/settings/sso' },
    'CC7.1': { description: 'System monitoring not configured', actionType: 'configure_monitoring', actionUrl: '/settings/monitoring' },
    'CC7.4': { description: 'Backup configuration not verified', actionType: 'configure_monitoring', actionUrl: '/settings/backups' },
    'CC7.5': { description: 'Deployment approval pipeline not configured', actionType: 'configure_monitoring', actionUrl: '/settings/deployments' },
    'CC8.1': { description: 'Deployment approval pipeline not configured', actionType: 'configure_monitoring', actionUrl: '/settings/deployments' },
  };
  return gapMap[controlId] ?? {
    description: 'Enable compliance evidence collection',
    actionType: 'upgrade_tier',
    actionUrl: '/billing/upgrade',
  };
}

function unconfiguredScore(): ComplianceScore {
  return {
    configured: false,
    totalControls: DEFAULT_TOTAL_CONTROLS,
    coveredControls: 0,
    coveragePercent: 0,
    evidenceCount: 0,
    evidenceWindow: { start: '', end: '' },
    lastCollectionAt: null,
    controls: [],
    trendData: [],
  };
}

async function getTrendData(totalControls: number): Promise<TrendPoint[]> {
  const points: TrendPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date();
    monthStart.setUTCMonth(monthStart.getUTCMonth() - i, 1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT control_id)::text AS count
       FROM compliance_evidence
       WHERE collected_at >= $1 AND collected_at < $2`,
      [monthStart.toISOString(), monthEnd.toISOString()],
    );

    points.push({
      date: monthStart.toISOString().slice(0, 7),
      coveredControls: parseInt(result.rows[0]?.count ?? '0', 10),
      totalControls,
    });
  }
  return points;
}

export async function getComplianceScore(): Promise<ComplianceScore> {
  const tableReady = await hasComplianceEvidenceTable();
  if (!tableReady) return unconfiguredScore();

  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setUTCMonth(twelveMonthsAgo.getUTCMonth() - 12);

  const controlsResult = await pool.query<ControlRow>(
    `SELECT
       c.id AS control_id,
       c.name,
       c.criteria_group,
       COUNT(e.id)::text AS evidence_count,
       MAX(e.collected_at)::text AS last_evidence_at
     FROM compliance_controls c
     LEFT JOIN compliance_evidence e
       ON e.control_id = c.id
      AND e.collected_at >= $1
     GROUP BY c.id, c.name, c.criteria_group, c.sort_order
     ORDER BY c.sort_order`,
    [twelveMonthsAgo.toISOString()],
  );

  const controls: ControlCoverage[] = controlsResult.rows.map((row) => {
    const evidenceCount = parseInt(row.evidence_count, 10);
    const covered = evidenceCount > 0;
    return {
      controlId: row.control_id,
      name: row.name,
      criteriaGroup: row.criteria_group,
      covered,
      evidenceCount,
      lastEvidenceAt: row.last_evidence_at,
      gapAction: covered ? undefined : getGapAction(row.control_id),
    };
  });

  const totalControls = controls.length || DEFAULT_TOTAL_CONTROLS;
  const coveredControls = controls.filter((c) => c.covered).length;

  const [evidenceCountResult, lastCollectionResult, trendData] = await Promise.all([
    pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM compliance_evidence`),
    pool.query<{ last_at: string | null }>(
      `SELECT MAX(collected_at)::text AS last_at FROM compliance_evidence`,
    ),
    getTrendData(totalControls),
  ]);

  return {
    configured: true,
    totalControls,
    coveredControls,
    coveragePercent: totalControls > 0
      ? Math.round((coveredControls / totalControls) * 100)
      : 0,
    evidenceCount: parseInt(evidenceCountResult.rows[0]?.count ?? '0', 10),
    evidenceWindow: {
      start: twelveMonthsAgo.toISOString(),
      end: new Date().toISOString(),
    },
    lastCollectionAt: lastCollectionResult.rows[0]?.last_at ?? null,
    controls,
    trendData,
  };
}

export function calculateScoutScore(
  securityScore: number,
  compliance: ComplianceScore,
): ScoutCombinedScore {
  const complianceScore = compliance.configured ? compliance.coveragePercent : 0;
  const total = Math.round(securityScore * 0.6 + complianceScore * 0.4);
  return { total, security: securityScore, compliance: complianceScore };
}
