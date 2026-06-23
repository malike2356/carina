import { pool } from '../../db.js';
import { RETENTION_POLICIES } from './retention-policy.js';

/**
 * Aggregated GDPR compliance report for the admin dashboard.
 *
 * Provides counts of:
 * - Pending SARs and their due dates
 * - Pending erasure requests
 * - Retention policy compliance status per event_type
 * - Total audit log volume
 */

export interface GdprReport {
  generated_at: string;
  pending_sars: number;
  overdue_sars: number;
  pending_erasures: number;
  overdue_erasures: number;
  retention_status: Array<{
    event_type: string;
    policy_days: number;
    oldest_row_age_days: number | null;
    row_count: number;
    compliant: boolean;
  }>;
  total_audit_rows: number;
}

export async function generateGdprReport(): Promise<GdprReport> {
  // Count pending/overdue SARs
  const sarResult = await pool.query<{
    pending: string;
    overdue: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE request_type = 'sar'
           AND status = 'pending'
           AND due_by > NOW()
       )::text AS pending,
       COUNT(*) FILTER (
         WHERE request_type = 'sar'
           AND status = 'pending'
           AND due_by <= NOW()
       )::text AS overdue
     FROM compliance_requests`,
  );

  const pendingSars = parseInt(sarResult.rows[0]?.pending ?? '0', 10);
  const overdueSars = parseInt(sarResult.rows[0]?.overdue ?? '0', 10);

  // Count pending/overdue erasures
  const eraResult = await pool.query<{
    pending: string;
    overdue: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE request_type = 'erasure'
           AND (status = 'pending' OR status IS NULL)
           AND due_by > NOW()
       )::text AS pending,
       COUNT(*) FILTER (
         WHERE request_type = 'erasure'
           AND (status = 'pending' OR status IS NULL)
           AND due_by <= NOW()
       )::text AS overdue
     FROM compliance_requests`,
  );

  const pendingErasures = parseInt(eraResult.rows[0]?.pending ?? '0', 10);
  const overdueErasures = parseInt(eraResult.rows[0]?.overdue ?? '0', 10);

  // Retention policy compliance per event_type
  const retentionStatus = [];
  for (const policy of RETENTION_POLICIES) {
    const statResult = await pool.query<{
      count: string;
      oldest_age_days: string | null;
    }>(
      `SELECT
         COUNT(*)::text AS count,
         EXTRACT(DAY FROM NOW() - MIN(timestamp))::text AS oldest_age_days
       FROM audit_log
       WHERE event_type = $1`,
      [policy.event_type],
    );

    const rowCount = parseInt(statResult.rows[0]?.count ?? '0', 10);
    const oldestAgeRaw = statResult.rows[0]?.oldest_age_days;
    const oldestAgeDays = oldestAgeRaw ? parseFloat(oldestAgeRaw) : null;

    retentionStatus.push({
      event_type: policy.event_type,
      policy_days: policy.retention_days,
      oldest_row_age_days: oldestAgeDays,
      row_count: rowCount,
      compliant: oldestAgeDays === null || oldestAgeDays <= policy.retention_days,
    });
  }

  // Total audit rows
  const totalResult = await pool.query<{ total: string }>(
    `SELECT COUNT(*)::text AS total FROM audit_log`,
  );
  const totalAuditRows = parseInt(totalResult.rows[0]?.total ?? '0', 10);

  return {
    generated_at: new Date().toISOString(),
    pending_sars: pendingSars,
    overdue_sars: overdueSars,
    pending_erasures: pendingErasures,
    overdue_erasures: overdueErasures,
    retention_status: retentionStatus,
    total_audit_rows: totalAuditRows,
  };
}
