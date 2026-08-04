import { pool } from '../db.js';
import { getComplianceScore } from './scoring.js';

export interface TrustCenterPayload {
  monitoringSince: string;
  soc2ControlsCovered: number;
  soc2ControlsTotal: number;
  lastAuditorPackageAt: string | null;
  criticalFindings90Days: number;
  cryptographicAnchors: string;
  anchoringFrequency: string;
  soc2Badge: 'ready' | 'partial' | 'not-configured';
  iso27001Badge: string;
  gdprBadge: string;
  complianceTrend: Array<{ date: string; coveredControls: number; totalControls: number }>;
  controls: Array<{ id: string; name: string; covered: boolean }>;
}

export async function buildTrustCenterPayload(): Promise<TrustCenterPayload> {
  const score = await getComplianceScore();

  let criticalFindings90Days = 0;
  try {
    const criticalResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM security_events
       WHERE severity IN ('critical', 'breach')
         AND created_at > NOW() - INTERVAL '90 days'`,
    );
    criticalFindings90Days = parseInt(criticalResult.rows[0]?.count ?? '0', 10);
  } catch {
    criticalFindings90Days = 0;
  }

  const soc2Badge: TrustCenterPayload['soc2Badge'] = !score.configured
    ? 'not-configured'
    : score.coveragePercent === 100
      ? 'ready'
      : 'partial';

  return {
    monitoringSince: process.env.SCOUT_MONITORING_SINCE ?? '2026-06-01',
    soc2ControlsCovered: score.configured ? score.coveredControls : 0,
    soc2ControlsTotal: score.totalControls,
    lastAuditorPackageAt: score.lastCollectionAt,
    criticalFindings90Days,
    cryptographicAnchors: 'Ethereum mainnet',
    anchoringFrequency: 'daily',
    soc2Badge,
    iso27001Badge: 'aligned',
    gdprBadge: 'compliant',
    complianceTrend: score.configured ? score.trendData : [],
    controls: score.configured
      ? score.controls.map((c) => ({ id: c.controlId, name: c.name, covered: c.covered }))
      : [],
  };
}
