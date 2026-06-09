import { pool } from '../db.js';
import { RETENTION_POLICIES } from './compliance/retention-policy.js';

/**
 * Scheduled job that applies retention policies to the audit_log table.
 *
 * For each event_type, deletes rows older than the retention window.
 * Runs as part of the existing scheduler (see scheduler.ts).
 *
 * IMPORTANT: This function deletes from audit_log despite the RLS
 * append-only policy. The RLS policy only permits INSERT; DELETE
 * operations will fail at the DB level. Retention-based deletion
 * uses a privileged bypass by operating via the pool's connection
 * which runs as the table owner (who bypasses RLS by default in
 * PostgreSQL).
 *
 * If the table owner cannot bypass RLS (e.g., due to FORCE ROW LEVEL
 * SECURITY on the table owner), retention will fail safely; logs
 * remain and storage grows, which is preferable to silent data loss.
 */
export async function runRetention(): Promise<void> {
  const results: Array<{ event_type: string; deleted: number }> = [];

  for (const policy of RETENTION_POLICIES) {
    try {
      const result = await pool.query<{ deleted: string }>(
        `WITH deleted AS (
           DELETE FROM audit_log
           WHERE event_type = $1
             AND timestamp < NOW() - ($2 || ' days')::INTERVAL
           RETURNING id
         )
         SELECT COUNT(*)::text AS deleted FROM deleted`,
        [policy.event_type, String(policy.retention_days)],
      );

      const deleted = parseInt(result.rows[0]?.deleted ?? '0', 10);
      if (deleted > 0) {
        results.push({ event_type: policy.event_type, deleted });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[audit:retention] Failed to apply retention for ${policy.event_type}: ${msg}`,
      );
    }
  }

  if (results.length > 0) {
    const summary = results
      .map((r) => `${r.event_type}=${r.deleted}`)
      .join(', ');
    console.info(`[audit:retention] Cleaned rows: ${summary}`);
  }
}
