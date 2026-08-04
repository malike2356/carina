import { pool } from '../../memory/db.js';
import { encryptCredentials, decryptCredentials } from '../../channels/credential-store.js';

export interface GoogleRecorderConnection {
  id: string;
  workerId: string;
  workspaceId: string;
  status: string;
  enabled: boolean;
  lastPollAt: Date | null;
  lastError: string | null;
  seenRecordingIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

let ensured = false;

export async function ensureGoogleRecorderTables(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_google_recorder_connections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      worker_id UUID NOT NULL UNIQUE,
      workspace_id UUID NOT NULL,
      encrypted_storage_state TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'connected',
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_poll_at TIMESTAMPTZ,
      last_error TEXT,
      seen_recording_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_aiva_google_recorder_ws
    ON aiva_google_recorder_connections (workspace_id)
  `);
  ensured = true;
}

function mapRow(row: Record<string, unknown>): GoogleRecorderConnection {
  const seen = row.seen_recording_ids;
  let seenIds: string[] = [];
  if (Array.isArray(seen)) {
    seenIds = seen.map(String);
  } else if (typeof seen === 'string') {
    try {
      const parsed = JSON.parse(seen) as unknown;
      if (Array.isArray(parsed)) seenIds = parsed.map(String);
    } catch {
      seenIds = [];
    }
  }
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    status: String(row.status ?? 'connected'),
    enabled: Boolean(row.enabled ?? true),
    lastPollAt: row.last_poll_at ? new Date(String(row.last_poll_at)) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    seenRecordingIds: seenIds,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

export async function upsertGoogleRecorderConnection(input: {
  workerId: string;
  workspaceId: string;
  storageStateJson: string;
  status?: string;
  enabled?: boolean;
}): Promise<GoogleRecorderConnection> {
  await ensureGoogleRecorderTables();
  const encrypted = encryptCredentials({ storageState: input.storageStateJson });
  const result = await pool.query(
    `INSERT INTO aiva_google_recorder_connections
       (worker_id, workspace_id, encrypted_storage_state, status, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (worker_id) DO UPDATE SET
       workspace_id = EXCLUDED.workspace_id,
       encrypted_storage_state = EXCLUDED.encrypted_storage_state,
       status = EXCLUDED.status,
       enabled = EXCLUDED.enabled,
       last_error = NULL,
       updated_at = NOW()
     RETURNING *`,
    [
      input.workerId,
      input.workspaceId,
      encrypted,
      input.status ?? 'connected',
      input.enabled !== false,
    ],
  );
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function getGoogleRecorderConnection(
  workerId: string,
): Promise<GoogleRecorderConnection | null> {
  await ensureGoogleRecorderTables();
  const result = await pool.query(
    `SELECT * FROM aiva_google_recorder_connections WHERE worker_id = $1`,
    [workerId],
  );
  if (!result.rows[0]) return null;
  return mapRow(result.rows[0] as Record<string, unknown>);
}

export async function listEnabledGoogleRecorderConnections(): Promise<GoogleRecorderConnection[]> {
  await ensureGoogleRecorderTables();
  const result = await pool.query(
    `SELECT * FROM aiva_google_recorder_connections
     WHERE enabled = TRUE AND status IN ('connected', 'degraded')
     ORDER BY updated_at ASC`,
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export async function getGoogleRecorderStorageState(workerId: string): Promise<object | null> {
  await ensureGoogleRecorderTables();
  const result = await pool.query(
    `SELECT encrypted_storage_state FROM aiva_google_recorder_connections WHERE worker_id = $1`,
    [workerId],
  );
  const row = result.rows[0] as { encrypted_storage_state?: string } | undefined;
  if (!row?.encrypted_storage_state) return null;
  const creds = decryptCredentials(row.encrypted_storage_state);
  const raw = creds.storageState?.trim();
  if (!raw) return null;
  return JSON.parse(raw) as object;
}

export async function markGoogleRecorderPollResult(input: {
  workerId: string;
  seenRecordingIds: string[];
  status: string;
  error?: string | null;
}): Promise<void> {
  await ensureGoogleRecorderTables();
  const capped = input.seenRecordingIds.slice(-500);
  await pool.query(
    `UPDATE aiva_google_recorder_connections
     SET last_poll_at = NOW(),
         seen_recording_ids = $2::jsonb,
         status = $3,
         last_error = $4,
         updated_at = NOW()
     WHERE worker_id = $1`,
    [input.workerId, JSON.stringify(capped), input.status, input.error ?? null],
  );
}

export async function deleteGoogleRecorderConnection(workerId: string): Promise<boolean> {
  await ensureGoogleRecorderTables();
  const result = await pool.query(
    `DELETE FROM aiva_google_recorder_connections WHERE worker_id = $1`,
    [workerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function setGoogleRecorderEnabled(workerId: string, enabled: boolean): Promise<void> {
  await ensureGoogleRecorderTables();
  await pool.query(
    `UPDATE aiva_google_recorder_connections
     SET enabled = $2, updated_at = NOW()
     WHERE worker_id = $1`,
    [workerId, enabled],
  );
}
