// Read/update APIs for repository secret scanning (account-scoped).
import { pool } from '../event-server/db.js';
import { REMEDIATION_STATUSES, type RemediationStatus } from './constants.js';

function publicFinding(row: Record<string, unknown>) {
  return {
    id: row.id,
    connector_id: row.connector_id,
    fingerprint: row.fingerprint,
    rule_id: row.rule_id,
    severity: row.severity,
    relative_path: row.relative_path,
    line: row.line_number,
    commit_id: row.commit_id,
    remediation_status: row.remediation_status,
    first_seen_at: row.first_seen_at,
    last_seen_at: row.last_seen_at,
    seen_count: row.seen_count,
    remediation_owner: row.remediation_owner,
    due_at: row.due_at,
    repository_alias: row.repository_alias,
  };
}

function publicScan(row: Record<string, unknown>) {
  return {
    id: row.id,
    connector_id: row.connector_id,
    scan_id: row.client_scan_id,
    mode: row.mode,
    scanner_name: row.scanner_name,
    scanner_version: row.scanner_version,
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    observed_at: row.observed_at,
    counts: {
      critical: row.count_critical,
      high: row.count_high,
      medium: row.count_medium,
      low: row.count_low,
      info: row.count_info,
    },
    findings_accepted: row.findings_accepted,
    findings_deduped: row.findings_deduped,
    repository_alias: row.repository_alias,
  };
}

function publicConnector(row: Record<string, unknown>) {
  return {
    id: row.id,
    connector_key: row.connector_key,
    repository_alias: row.repository_alias,
    product: row.product,
    status: row.status,
    last_ingest_at: row.last_ingest_at,
    created_at: row.created_at,
  };
}

export async function listConnectors(accountId: string) {
  const r = await pool.query(
    `SELECT * FROM repo_connectors WHERE account_id = $1 ORDER BY updated_at DESC LIMIT 200`,
    [accountId],
  );
  return r.rows.map((row) => publicConnector(row));
}

export async function listScanRuns(accountId: string, limit = 50, offset = 0) {
  const r = await pool.query(
    `SELECT s.*, c.repository_alias
     FROM repo_secret_scan_runs s
     JOIN repo_connectors c ON c.id = s.connector_id
     WHERE s.account_id = $1
     ORDER BY s.observed_at DESC
     LIMIT $2 OFFSET $3`,
    [accountId, limit, offset],
  );
  return r.rows.map((row) => publicScan(row));
}

export async function listFindings(
  accountId: string,
  opts: { status?: string; limit?: number; offset?: number } = {},
) {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const params: unknown[] = [accountId];
  let statusClause = '';
  if (opts.status === 'open') {
    statusClause =
      "AND f.remediation_status NOT IN ('resolved', 'accepted-risk', 'false-positive')";
  } else if (opts.status) {
    params.push(opts.status);
    statusClause = `AND f.remediation_status = $${params.length}`;
  }
  params.push(limit, offset);
  const r = await pool.query(
    `SELECT f.*, c.repository_alias
     FROM repo_secret_findings f
     JOIN repo_connectors c ON c.id = f.connector_id
     WHERE f.account_id = $1 ${statusClause}
     ORDER BY
       CASE f.severity
         WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4
       END,
       f.last_seen_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return r.rows.map((row) => publicFinding(row));
}

export async function getAggregatePosture(accountId: string) {
  const open = await pool.query<{ severity: string; count: string }>(
    `SELECT severity, COUNT(*)::text AS count
     FROM repo_secret_findings
     WHERE account_id = $1
       AND remediation_status NOT IN ('resolved', 'accepted-risk', 'false-positive')
     GROUP BY severity`,
    [accountId],
  );
  const bySeverity: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const row of open.rows) {
    bySeverity[row.severity] = parseInt(row.count, 10) || 0;
  }

  const connectors = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM repo_connectors WHERE account_id = $1 AND status = 'active'`,
    [accountId],
  );
  const lastScan = await pool.query<{ observed_at: string }>(
    `SELECT observed_at FROM repo_secret_scan_runs WHERE account_id = $1 ORDER BY observed_at DESC LIMIT 1`,
    [accountId],
  );

  return {
    open_by_severity: bySeverity,
    open_total: Object.values(bySeverity).reduce((a, b) => a + b, 0),
    active_connectors: parseInt(connectors.rows[0]?.count ?? '0', 10),
    last_scan_at: lastScan.rows[0]?.observed_at ?? null,
  };
}

export async function transitionRemediation(params: {
  accountId: string;
  findingId: string;
  toStatus: string;
  actor: string;
  reason?: string;
}): Promise<{ ok: true; finding: ReturnType<typeof publicFinding> } | { ok: false; code: string }> {
  if (!(REMEDIATION_STATUSES as readonly string[]).includes(params.toStatus)) {
    return { ok: false, code: 'invalid_status' };
  }
  const current = await pool.query<{ remediation_status: string }>(
    `SELECT remediation_status FROM repo_secret_findings WHERE account_id = $1 AND id = $2 LIMIT 1`,
    [params.accountId, params.findingId],
  );
  if (!current.rows[0]) return { ok: false, code: 'not_found' };

  await pool.query(
    `UPDATE repo_secret_findings
     SET remediation_status = $3, updated_at = NOW()
     WHERE account_id = $1 AND id = $2`,
    [params.accountId, params.findingId, params.toStatus],
  );
  await pool.query(
    `INSERT INTO repo_secret_remediation_events
       (account_id, finding_id, from_status, to_status, actor, reason)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      params.accountId,
      params.findingId,
      current.rows[0].remediation_status,
      params.toStatus,
      params.actor,
      params.reason ?? null,
    ],
  );

  const updated = await pool.query(
    `SELECT f.*, c.repository_alias
     FROM repo_secret_findings f
     JOIN repo_connectors c ON c.id = f.connector_id
     WHERE f.id = $1`,
    [params.findingId],
  );
  return { ok: true, finding: publicFinding(updated.rows[0]) };
}

export type { RemediationStatus };
