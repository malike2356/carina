// Health snippet for repository secret scanning tables.
import { pool } from '../event-server/db.js';

export async function getSecretScanHealth(): Promise<Record<string, unknown>> {
  let tablesOk = false;
  try {
    await pool.query('SELECT 1 FROM repo_connectors LIMIT 1');
    await pool.query('SELECT 1 FROM repo_secret_scan_runs LIMIT 1');
    tablesOk = true;
  } catch {
    tablesOk = false;
  }

  const lastIngest = tablesOk
    ? await pool.query<{ created_at: string }>(
        `SELECT created_at FROM repo_secret_ingestion_receipts ORDER BY created_at DESC LIMIT 1`,
      )
    : null;
  const openCount = tablesOk
    ? await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM repo_secret_findings
         WHERE remediation_status NOT IN ('resolved', 'accepted-risk', 'false-positive')`,
      )
    : null;

  return {
    tables_ready: tablesOk,
    last_ingest_at: lastIngest?.rows[0]?.created_at ?? null,
    open_findings: parseInt(openCount?.rows[0]?.count ?? '0', 10),
  };
}
