import { pool } from '../memory/db.js';
import type { ProcessNotify, ProcessStatus, ProcessWatchRule } from './process-types.js';

export interface PersistedProcessRow {
  id: string;
  pid: number;
  command: string;
  workdir: string | null;
  label: string | null;
  status: ProcessStatus;
  exit_code: number | null;
  owner_session_id: string | null;
  dedupe_key: string | null;
  watch_rules: ProcessWatchRule[];
  notify_complete: ProcessNotify | null;
  notify_failure: ProcessNotify | null;
  matched_patterns: string[];
  output_line_count: number;
  started_at: Date;
  ended_at: Date | null;
}

const BACKGROUND_PROCESS_MIGRATION = `
CREATE TABLE IF NOT EXISTS background_processes (
  id UUID PRIMARY KEY,
  pid INT,
  command TEXT NOT NULL,
  workdir TEXT,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'running',
  exit_code INT,
  owner_session_id TEXT,
  dedupe_key TEXT,
  watch_rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  notify_complete JSONB,
  notify_failure JSONB,
  matched_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_line_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_background_processes_status
  ON background_processes (status, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_background_processes_dedupe_running
  ON background_processes (dedupe_key)
  WHERE status = 'running' AND dedupe_key IS NOT NULL;
`;

export { BACKGROUND_PROCESS_MIGRATION };

export async function persistProcessStart(input: {
  processId: string;
  pid: number;
  command: string;
  workdir?: string;
  label?: string;
  ownerSessionId?: string;
  dedupeKey?: string;
  watchRules?: ProcessWatchRule[];
  notifyOnComplete?: ProcessNotify;
  notifyOnFailure?: ProcessNotify;
}): Promise<void> {
  await pool.query(
    `INSERT INTO background_processes
       (id, pid, command, workdir, label, status, owner_session_id, dedupe_key,
        watch_rules, notify_complete, notify_failure, matched_patterns, output_line_count)
     VALUES ($1,$2,$3,$4,$5,'running',$6,$7,$8,$9,$10,'[]'::jsonb,0)
     ON CONFLICT (id) DO UPDATE SET
       pid = EXCLUDED.pid,
       status = 'running',
       updated_at = NOW()`,
    [
      input.processId,
      input.pid,
      input.command,
      input.workdir ?? null,
      input.label ?? null,
      input.ownerSessionId ?? null,
      input.dedupeKey ?? null,
      JSON.stringify(input.watchRules ?? []),
      input.notifyOnComplete ? JSON.stringify(input.notifyOnComplete) : null,
      input.notifyOnFailure ? JSON.stringify(input.notifyOnFailure) : null,
    ],
  );
}

export async function persistProcessPatch(
  processId: string,
  patch: {
    status?: ProcessStatus;
    exitCode?: number;
    endedAt?: Date;
    matchedPatterns?: string[];
    outputLineCount?: number;
    pid?: number;
  },
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    status: patch.status,
    exit_code: patch.exitCode,
    ended_at: patch.endedAt,
    matched_patterns: patch.matchedPatterns ? JSON.stringify(patch.matchedPatterns) : undefined,
    output_line_count: patch.outputLineCount,
    pid: patch.pid,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return;
  values.push(processId);
  await pool.query(
    `UPDATE background_processes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx}`,
    values,
  );
}

export async function findRunningByDedupeKey(dedupeKey: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM background_processes WHERE dedupe_key = $1 AND status = 'running' LIMIT 1`,
    [dedupeKey],
  );
  return result.rows[0]?.id ?? null;
}

export async function listPersistedRunning(): Promise<PersistedProcessRow[]> {
  const result = await pool.query(
    `SELECT * FROM background_processes WHERE status = 'running' ORDER BY started_at DESC`,
  );
  return result.rows.map(rowToPersisted);
}

export async function listPersistedProcesses(limit = 50): Promise<PersistedProcessRow[]> {
  const result = await pool.query(
    `SELECT * FROM background_processes ORDER BY started_at DESC LIMIT $1`,
    [limit],
  );
  return result.rows.map(rowToPersisted);
}

export async function getPersistedProcess(processId: string): Promise<PersistedProcessRow | null> {
  const result = await pool.query(`SELECT * FROM background_processes WHERE id = $1`, [processId]);
  if (result.rows.length === 0) return null;
  return rowToPersisted(result.rows[0]);
}

function rowToPersisted(row: Record<string, unknown>): PersistedProcessRow {
  return {
    id: String(row.id),
    pid: Number(row.pid ?? 0),
    command: String(row.command),
    workdir: row.workdir ? String(row.workdir) : null,
    label: row.label ? String(row.label) : null,
    status: String(row.status) as ProcessStatus,
    exit_code: row.exit_code != null ? Number(row.exit_code) : null,
    owner_session_id: row.owner_session_id ? String(row.owner_session_id) : null,
    dedupe_key: row.dedupe_key ? String(row.dedupe_key) : null,
    watch_rules: (row.watch_rules as ProcessWatchRule[]) ?? [],
    notify_complete: row.notify_complete as ProcessNotify | null,
    notify_failure: row.notify_failure as ProcessNotify | null,
    matched_patterns: (row.matched_patterns as string[]) ?? [],
    output_line_count: Number(row.output_line_count ?? 0),
    started_at: new Date(String(row.started_at)),
    ended_at: row.ended_at ? new Date(String(row.ended_at)) : null,
  };
}
