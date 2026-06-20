import type { ScoutFinding, ScoutInvestigation } from './scout-findings-types.js';

export const SCOUT_INVESTIGATIONS_MIGRATION = `
CREATE TABLE IF NOT EXISTS carina_investigations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id TEXT NOT NULL,
  operator_id TEXT NOT NULL DEFAULT 'local',
  status TEXT NOT NULL DEFAULT 'opened'
    CHECK (status IN ('opened','in_progress','exploit_attempted','exploit_successful','remediated','closed')),
  tools_used TEXT[] NOT NULL DEFAULT '{}',
  sessions TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  evidence_path TEXT,
  chain_of_custody JSONB NOT NULL DEFAULT '[]'::jsonb,
  stix_report_path TEXT,
  finding_snapshot JSONB,
  obsidian_case_id TEXT,
  obsidian_case_path TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_carina_investigations_finding
  ON carina_investigations (finding_id);

CREATE INDEX IF NOT EXISTS idx_carina_investigations_status
  ON carina_investigations (status, opened_at DESC);
`;

interface InvestigationRow {
  id: string;
  finding_id: string;
  operator_id: string;
  status: string;
  tools_used: string[];
  sessions: string[];
  notes: string | null;
  evidence_path: string | null;
  chain_of_custody: unknown;
  stix_report_path: string | null;
  finding_snapshot: ScoutFinding | null;
  obsidian_case_id: string | null;
  obsidian_case_path: string | null;
  opened_at: string;
  closed_at: string | null;
  updated_at: string;
}

function mapRow(row: InvestigationRow): ScoutInvestigation & {
  operatorId: string;
  toolsUsed: string[];
  sessions: string[];
  evidencePath: string | null;
  chainOfCustody: unknown;
  stixReportPath: string | null;
  closedAt: string | null;
} {
  const finding = row.finding_snapshot ?? {
    id: row.finding_id,
    scanRunId: null,
    targetId: '',
    accountId: '',
    tool: 'unknown',
    findingType: 'unknown',
    severity: 'info',
    cvssScore: null,
    title: row.finding_id,
    description: null,
    remediation: null,
    rawData: {},
    status: 'open',
    isNew: false,
    firstSeen: row.opened_at,
    lastSeen: row.opened_at,
    createdAt: row.opened_at,
  };

  return {
    id: row.id,
    findingId: row.finding_id,
    status: row.status as ScoutInvestigation['status'],
    toolsSuggested: row.tools_used,
    notes: row.notes ?? '',
    openedAt: row.opened_at,
    updatedAt: row.updated_at,
    finding,
    obsidianCaseId: row.obsidian_case_id ?? undefined,
    obsidianCasePath: row.obsidian_case_path ?? undefined,
    operatorId: row.operator_id,
    toolsUsed: row.tools_used,
    sessions: row.sessions,
    evidencePath: row.evidence_path,
    chainOfCustody: row.chain_of_custody,
    stixReportPath: row.stix_report_path,
    closedAt: row.closed_at,
  };
}

async function getPool(): Promise<import('pg').Pool | null> {
  try {
    const { pool } = await import('../memory/db.js');
    return pool;
  } catch {
    return null;
  }
}

export async function isInvestigationsDbAvailable(): Promise<boolean> {
  const pool = await getPool();
  if (!pool) return false;
  try {
    await pool.query('SELECT 1 FROM carina_investigations LIMIT 1');
    return true;
  } catch {
    return false;
  }
}

export async function insertInvestigationRow(input: {
  id: string;
  finding: ScoutFinding;
  toolsSuggested: string[];
  notes?: string;
  operatorId?: string;
}): Promise<void> {
  const pool = await getPool();
  if (!pool) return;

  await pool.query(
    `INSERT INTO carina_investigations (
       id, finding_id, operator_id, status, tools_used, notes, finding_snapshot, opened_at, updated_at
     )
     VALUES ($1, $2, $3, 'opened', $4, $5, $6, NOW(), NOW())`,
    [
      input.id,
      input.finding.id,
      input.operatorId ?? process.env.USER ?? 'local',
      input.toolsSuggested,
      input.notes ?? '',
      JSON.stringify(input.finding),
    ],
  );
}

export async function updateInvestigationRow(
  id: string,
  patch: Partial<{
    status: ScoutInvestigation['status'];
    notes: string;
    stixReportPath: string;
    evidencePath: string;
    obsidianCaseId: string;
    obsidianCasePath: string;
    toolsUsed: string[];
    closedAt: string | null;
  }>,
): Promise<void> {
  const pool = await getPool();
  if (!pool) return;

  await pool.query(
    `UPDATE carina_investigations
     SET status = COALESCE($2, status),
         notes = COALESCE($3, notes),
         stix_report_path = COALESCE($4, stix_report_path),
         evidence_path = COALESCE($5, evidence_path),
         obsidian_case_id = COALESCE($6, obsidian_case_id),
         obsidian_case_path = COALESCE($7, obsidian_case_path),
         tools_used = COALESCE($8, tools_used),
         closed_at = COALESCE($9, closed_at),
         updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      patch.status ?? null,
      patch.notes ?? null,
      patch.stixReportPath ?? null,
      patch.evidencePath ?? null,
      patch.obsidianCaseId ?? null,
      patch.obsidianCasePath ?? null,
      patch.toolsUsed ?? null,
      patch.closedAt ?? null,
    ],
  );
}

export async function listInvestigationRows(): Promise<ScoutInvestigation[]> {
  const pool = await getPool();
  if (!pool) return [];

  try {
    const result = await pool.query<InvestigationRow>(
      `SELECT id, finding_id, operator_id, status, tools_used, sessions, notes,
              evidence_path, chain_of_custody, stix_report_path, finding_snapshot,
              obsidian_case_id, obsidian_case_path, opened_at, closed_at, updated_at
       FROM carina_investigations
       ORDER BY opened_at DESC`,
    );
    return result.rows.map((row) => mapRow(row));
  } catch {
    return [];
  }
}

export async function loadInvestigationRow(id: string): Promise<ScoutInvestigation | null> {
  const pool = await getPool();
  if (!pool) return null;

  try {
    const result = await pool.query<InvestigationRow>(
      `SELECT id, finding_id, operator_id, status, tools_used, sessions, notes,
              evidence_path, chain_of_custody, stix_report_path, finding_snapshot,
              obsidian_case_id, obsidian_case_path, opened_at, closed_at, updated_at
       FROM carina_investigations
       WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? mapRow(row) : null;
  } catch {
    return null;
  }
}
