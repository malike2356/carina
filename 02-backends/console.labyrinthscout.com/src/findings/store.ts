import { pool } from '../db.js';
import { seedScanConfigsForTarget } from './scan-config.js';
import type {
  AlertType,
  CreateFindingInput,
  CreateTargetInput,
  Finding,
  FindingListFilters,
  FindingSeverity,
  FindingStatus,
  ScanRun,
  ScoutScoreSnapshot,
  Target,
  TargetType,
  UpdateFindingInput,
} from './types.js';

interface TargetRow {
  id: string;
  account_id: string;
  target: string;
  target_type: TargetType;
  label: string | null;
  is_active: boolean;
  created_at: string;
}

interface ScanRunRow {
  id: string;
  target_id: string;
  account_id: string;
  tool: string;
  status: ScanRun['status'];
  started_at: string | null;
  completed_at: string | null;
  findings_count: number;
  error_message: string | null;
  raw_output_path: string | null;
  created_at: string;
}

interface FindingRow {
  id: string;
  scan_run_id: string | null;
  target_id: string;
  account_id: string;
  tool: string;
  finding_type: string;
  severity: FindingSeverity;
  cvss_score: string | null;
  title: string;
  description: string | null;
  remediation: string | null;
  raw_data: Record<string, unknown>;
  status: FindingStatus;
  is_new: boolean;
  first_seen: string;
  last_seen: string;
  created_at: string;
}

interface ScoreRow {
  score: number;
  open_critical: number;
  open_high: number;
  open_medium: number;
  open_low: number;
  calculated_at: string;
}

function mapTarget(row: TargetRow): Target {
  return {
    id: row.id,
    accountId: row.account_id,
    target: row.target,
    targetType: row.target_type,
    label: row.label,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

function mapScanRun(row: ScanRunRow): ScanRun {
  return {
    id: row.id,
    targetId: row.target_id,
    accountId: row.account_id,
    tool: row.tool,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    findingsCount: row.findings_count,
    errorMessage: row.error_message,
    rawOutputPath: row.raw_output_path,
    createdAt: row.created_at,
  };
}

function mapFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    scanRunId: row.scan_run_id,
    targetId: row.target_id,
    accountId: row.account_id,
    tool: row.tool,
    findingType: row.finding_type,
    severity: row.severity,
    cvssScore: row.cvss_score !== null ? parseFloat(row.cvss_score) : null,
    title: row.title,
    description: row.description,
    remediation: row.remediation,
    rawData: row.raw_data ?? {},
    status: row.status,
    isNew: row.is_new,
    firstSeen: row.first_seen,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
  };
}

function mapScore(row: ScoreRow): ScoutScoreSnapshot {
  return {
    score: row.score,
    openCritical: row.open_critical,
    openHigh: row.open_high,
    openMedium: row.open_medium,
    openLow: row.open_low,
    calculatedAt: row.calculated_at,
  };
}

export async function createTarget(input: CreateTargetInput): Promise<Target> {
  const result = await pool.query<TargetRow>(
    `INSERT INTO targets (account_id, target, target_type, label)
     VALUES ($1, $2, $3, $4)
     RETURNING id, account_id, target, target_type, label, is_active, created_at`,
    [input.accountId, input.target.trim(), input.targetType, input.label?.trim() ?? null],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Target insert returned no row');
  const target = mapTarget(row);
  try {
    await seedScanConfigsForTarget(input.accountId, target.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout:targets] scan config seed failed:', msg);
  }
  return target;
}

export async function listTargets(accountId: string, activeOnly = true): Promise<Target[]> {
  const result = await pool.query<TargetRow>(
    `SELECT id, account_id, target, target_type, label, is_active, created_at
     FROM targets
     WHERE account_id = $1
       AND ($2::boolean = FALSE OR is_active = TRUE)
     ORDER BY created_at DESC`,
    [accountId, activeOnly],
  );
  return result.rows.map(mapTarget);
}

export async function getTargetById(accountId: string, targetId: string): Promise<Target | null> {
  const result = await pool.query<TargetRow>(
    `SELECT id, account_id, target, target_type, label, is_active, created_at
     FROM targets
     WHERE id = $1 AND account_id = $2`,
    [targetId, accountId],
  );
  const row = result.rows[0];
  return row ? mapTarget(row) : null;
}

export async function deactivateTarget(accountId: string, targetId: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE targets SET is_active = FALSE
     WHERE id = $1 AND account_id = $2 AND is_active = TRUE`,
    [targetId, accountId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function queueScanRun(
  accountId: string,
  targetId: string,
  tool: string,
): Promise<ScanRun | null> {
  const target = await getTargetById(accountId, targetId);
  if (!target || !target.isActive) return null;

  const result = await pool.query<ScanRunRow>(
    `INSERT INTO scan_runs (target_id, account_id, tool, status)
     VALUES ($1, $2, $3, 'queued')
     RETURNING id, target_id, account_id, tool, status, started_at, completed_at,
               findings_count, error_message, raw_output_path, created_at`,
    [targetId, accountId, tool],
  );
  const row = result.rows[0];
  return row ? mapScanRun(row) : null;
}

export async function listScanRuns(
  accountId: string,
  opts: { targetId?: string; limit?: number; offset?: number } = {},
): Promise<ScanRun[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const result = await pool.query<ScanRunRow>(
    `SELECT id, target_id, account_id, tool, status, started_at, completed_at,
            findings_count, error_message, raw_output_path, created_at
     FROM scan_runs
     WHERE account_id = $1
       AND ($2::uuid IS NULL OR target_id = $2)
     ORDER BY created_at DESC
     LIMIT $3 OFFSET $4`,
    [accountId, opts.targetId ?? null, limit, offset],
  );
  return result.rows.map(mapScanRun);
}

export async function getScanRunById(accountId: string, scanId: string): Promise<ScanRun | null> {
  const result = await pool.query<ScanRunRow>(
    `SELECT id, target_id, account_id, tool, status, started_at, completed_at,
            findings_count, error_message, raw_output_path, created_at
     FROM scan_runs
     WHERE id = $1 AND account_id = $2`,
    [scanId, accountId],
  );
  const row = result.rows[0];
  return row ? mapScanRun(row) : null;
}

export async function createFinding(input: CreateFindingInput): Promise<Finding | null> {
  const target = await getTargetById(input.accountId, input.targetId);
  if (!target) return null;

  const result = await pool.query<FindingRow>(
    `INSERT INTO findings (
       scan_run_id, target_id, account_id, tool, finding_type, severity,
       cvss_score, title, description, remediation, raw_data
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, scan_run_id, target_id, account_id, tool, finding_type, severity,
               cvss_score, title, description, remediation, raw_data, status, is_new,
               first_seen, last_seen, created_at`,
    [
      input.scanRunId ?? null,
      input.targetId,
      input.accountId,
      input.tool,
      input.findingType,
      input.severity,
      input.cvssScore ?? null,
      input.title,
      input.description ?? null,
      input.remediation ?? null,
      JSON.stringify(input.rawData ?? {}),
    ],
  );
  const row = result.rows[0];
  if (!row) return null;

  if (input.severity === 'critical') {
    await createAlert(input.accountId, row.id, 'new_critical');
  }

  return mapFinding(row);
}

export async function listFindings(
  accountId: string,
  filters: FindingListFilters = {},
): Promise<Finding[]> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);
  const result = await pool.query<FindingRow>(
    `SELECT id, scan_run_id, target_id, account_id, tool, finding_type, severity,
            cvss_score, title, description, remediation, raw_data, status, is_new,
            first_seen, last_seen, created_at
     FROM findings
     WHERE account_id = $1
       AND ($2::text IS NULL OR severity = $2)
       AND ($3::text IS NULL OR tool = $3)
       AND ($4::text IS NULL OR status = $4)
       AND ($5::uuid IS NULL OR target_id = $5)
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
         ELSE 5
       END,
       created_at DESC
     LIMIT $6 OFFSET $7`,
    [
      accountId,
      filters.severity ?? null,
      filters.tool ?? null,
      filters.status ?? null,
      filters.targetId ?? null,
      limit,
      offset,
    ],
  );
  return result.rows.map(mapFinding);
}

export async function getFindingById(accountId: string, findingId: string): Promise<Finding | null> {
  const result = await pool.query<FindingRow>(
    `SELECT id, scan_run_id, target_id, account_id, tool, finding_type, severity,
            cvss_score, title, description, remediation, raw_data, status, is_new,
            first_seen, last_seen, created_at
     FROM findings
     WHERE id = $1 AND account_id = $2`,
    [findingId, accountId],
  );
  const row = result.rows[0];
  return row ? mapFinding(row) : null;
}

export async function updateFinding(
  accountId: string,
  findingId: string,
  input: UpdateFindingInput,
): Promise<Finding | null> {
  const existing = await getFindingById(accountId, findingId);
  if (!existing) return null;

  const result = await pool.query<FindingRow>(
    `UPDATE findings
     SET status = COALESCE($3, status),
         severity = COALESCE($4, severity),
         description = COALESCE($5, description),
         remediation = COALESCE($6, remediation),
         is_new = COALESCE($7, is_new),
         last_seen = NOW()
     WHERE id = $1 AND account_id = $2
     RETURNING id, scan_run_id, target_id, account_id, tool, finding_type, severity,
               cvss_score, title, description, remediation, raw_data, status, is_new,
               first_seen, last_seen, created_at`,
    [
      findingId,
      accountId,
      input.status ?? null,
      input.severity ?? null,
      input.description ?? null,
      input.remediation ?? null,
      input.isNew ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;

  if (input.severity && input.severity !== existing.severity) {
    await createAlert(accountId, findingId, 'severity_change');
  }

  return mapFinding(row);
}

export async function countOpenFindingsBySeverity(
  accountId: string,
): Promise<Record<FindingSeverity, number>> {
  const result = await pool.query<{ severity: FindingSeverity; count: string }>(
    `SELECT severity, COUNT(*)::text AS count
     FROM findings
     WHERE account_id = $1
       AND status IN ('open', 'investigating', 'confirmed')
     GROUP BY severity`,
    [accountId],
  );
  const counts: Record<FindingSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const row of result.rows) {
    counts[row.severity] = parseInt(row.count, 10);
  }
  return counts;
}

export async function countOpenPortsWithoutVuln(accountId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM findings
     WHERE account_id = $1
       AND status IN ('open', 'investigating', 'confirmed')
       AND finding_type = 'open_port'
       AND severity = 'info'`,
    [accountId],
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function recordScoreSnapshot(
  accountId: string,
  snapshot: Omit<ScoutScoreSnapshot, 'calculatedAt'>,
): Promise<ScoutScoreSnapshot> {
  const result = await pool.query<ScoreRow>(
    `INSERT INTO scout_scores (
       account_id, score, open_critical, open_high, open_medium, open_low
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING score, open_critical, open_high, open_medium, open_low, calculated_at`,
    [
      accountId,
      snapshot.score,
      snapshot.openCritical,
      snapshot.openHigh,
      snapshot.openMedium,
      snapshot.openLow,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Score snapshot insert returned no row');
  return mapScore(row);
}

export async function listScoreHistory(
  accountId: string,
  limit = 30,
): Promise<ScoutScoreSnapshot[]> {
  const capped = Math.min(Math.max(limit, 1), 365);
  const result = await pool.query<ScoreRow>(
    `SELECT score, open_critical, open_high, open_medium, open_low, calculated_at
     FROM scout_scores
     WHERE account_id = $1
     ORDER BY calculated_at DESC
     LIMIT $2`,
    [accountId, capped],
  );
  return result.rows.map(mapScore);
}

async function createAlert(
  accountId: string,
  findingId: string,
  alertType: AlertType,
): Promise<void> {
  await pool.query(
    `INSERT INTO alerts (account_id, finding_id, alert_type)
     VALUES ($1, $2, $3)`,
    [accountId, findingId, alertType],
  );
}

export type ClaimedScanRun = ScanRun & {
  target: string;
  targetType: TargetType;
};

export async function claimNextQueuedScan(): Promise<ClaimedScanRun | null> {
  const result = await pool.query<ScanRunRow & { target: string; target_type: TargetType }>(`
    WITH next AS (
      SELECT id FROM scan_runs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE scan_runs sr
    SET status = 'running', started_at = NOW()
    FROM next, targets t
    WHERE sr.id = next.id
      AND sr.target_id = t.id
    RETURNING sr.id, sr.target_id, sr.account_id, sr.tool, sr.status, sr.started_at,
              sr.completed_at, sr.findings_count, sr.error_message, sr.raw_output_path,
              sr.created_at, t.target, t.target_type
  `);
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...mapScanRun(row),
    target: row.target,
    targetType: row.target_type,
  };
}

export async function completeScanRun(
  scanId: string,
  findingsCount: number,
): Promise<void> {
  await pool.query(
    `UPDATE scan_runs
     SET status = 'completed', completed_at = NOW(), findings_count = $2
     WHERE id = $1`,
    [scanId, findingsCount],
  );
}

export async function failScanRun(scanId: string, errorMessage: string): Promise<void> {
  await pool.query(
    `UPDATE scan_runs
     SET status = 'failed', completed_at = NOW(), error_message = $2
     WHERE id = $1`,
    [scanId, errorMessage.slice(0, 2000)],
  );
}

export async function getScanRunByIdOnly(scanId: string): Promise<ScanRun | null> {
  const result = await pool.query<ScanRunRow>(
    `SELECT id, target_id, account_id, tool, status, started_at, completed_at,
            findings_count, error_message, raw_output_path, created_at
     FROM scan_runs
     WHERE id = $1`,
    [scanId],
  );
  const row = result.rows[0];
  return row ? mapScanRun(row) : null;
}

export async function listFindingsForScanRun(
  accountId: string,
  scanRunId: string,
): Promise<Finding[]> {
  const result = await pool.query<FindingRow>(
    `SELECT id, scan_run_id, target_id, account_id, tool, finding_type, severity,
            cvss_score, title, description, remediation, raw_data, status, is_new,
            first_seen, last_seen, created_at
     FROM findings
     WHERE account_id = $1 AND scan_run_id = $2
     ORDER BY
       CASE severity
         WHEN 'critical' THEN 1
         WHEN 'high' THEN 2
         WHEN 'medium' THEN 3
         WHEN 'low' THEN 4
         ELSE 5
       END,
       created_at DESC`,
    [accountId, scanRunId],
  );
  return result.rows.map(mapFinding);
}

export async function getTargetForAccount(
  accountId: string,
  target: string,
): Promise<Target | null> {
  const result = await pool.query<TargetRow>(
    `SELECT id, account_id, target, target_type, label, is_active, created_at
     FROM targets
     WHERE account_id = $1 AND target = $2`,
    [accountId, target],
  );
  const row = result.rows[0];
  return row ? mapTarget(row) : null;
}
