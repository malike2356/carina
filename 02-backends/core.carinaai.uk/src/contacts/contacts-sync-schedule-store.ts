import { pool } from '../memory/db.js';

export type ContactsSyncSchedule = {
  workspaceId: string;
  enabled: boolean;
  timesPerDay: number;
  timezone: string;
  lastRunAt: string | null;
  lastResult: ContactsSyncLastResult | null;
  updatedAt: string;
};

export type ContactsSyncLastResult = {
  ok: boolean;
  imported?: number;
  skipped?: number;
  error?: string;
  at?: string;
};

const DEFAULT_TIMES_PER_DAY = 1;
const DEFAULT_TIMEZONE = 'Europe/London';

let schemaReady = false;

export async function ensureContactsSyncScheduleSchema(): Promise<void> {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiva_contacts_sync_schedules (
      workspace_id UUID PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      times_per_day INTEGER NOT NULL DEFAULT 1,
      timezone TEXT NOT NULL DEFAULT 'Europe/London',
      last_run_at TIMESTAMPTZ,
      last_result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  schemaReady = true;
}

function clampTimesPerDay(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return DEFAULT_TIMES_PER_DAY;
  return Math.max(1, Math.min(4, Math.floor(n)));
}

function mapRow(row: Record<string, unknown>): ContactsSyncSchedule {
  return {
    workspaceId: String(row.workspace_id),
    enabled: Boolean(row.enabled),
    timesPerDay: clampTimesPerDay(row.times_per_day),
    timezone: String(row.timezone ?? DEFAULT_TIMEZONE) || DEFAULT_TIMEZONE,
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
    lastResult: (row.last_result as ContactsSyncLastResult | null) ?? null,
    updatedAt: new Date(String(row.updated_at ?? Date.now())).toISOString(),
  };
}

export function defaultContactsSyncSchedule(workspaceId: string): ContactsSyncSchedule {
  return {
    workspaceId,
    enabled: true,
    timesPerDay: DEFAULT_TIMES_PER_DAY,
    timezone: DEFAULT_TIMEZONE,
    lastRunAt: null,
    lastResult: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function getContactsSyncSchedule(
  workspaceId: string,
): Promise<ContactsSyncSchedule> {
  await ensureContactsSyncScheduleSchema();
  const result = await pool.query(
    `SELECT workspace_id, enabled, times_per_day, timezone, last_run_at, last_result, updated_at
     FROM aiva_contacts_sync_schedules
     WHERE workspace_id = $1`,
    [workspaceId],
  );
  if (result.rows.length === 0) return defaultContactsSyncSchedule(workspaceId);
  return mapRow(result.rows[0] as Record<string, unknown>);
}

/** Insert default enabled schedule if missing. Used after Google connect / first sync. */
export async function ensureDefaultContactsSyncSchedule(
  workspaceId: string,
): Promise<ContactsSyncSchedule> {
  await ensureContactsSyncScheduleSchema();
  await pool.query(
    `INSERT INTO aiva_contacts_sync_schedules (workspace_id, enabled, times_per_day, timezone)
     VALUES ($1, TRUE, $2, $3)
     ON CONFLICT (workspace_id) DO NOTHING`,
    [workspaceId, DEFAULT_TIMES_PER_DAY, DEFAULT_TIMEZONE],
  );
  return getContactsSyncSchedule(workspaceId);
}

export async function upsertContactsSyncSchedule(
  workspaceId: string,
  patch: {
    enabled?: boolean;
    timesPerDay?: number;
    timezone?: string;
  },
): Promise<ContactsSyncSchedule> {
  await ensureContactsSyncScheduleSchema();
  const current = await getContactsSyncSchedule(workspaceId);
  const enabled = patch.enabled ?? current.enabled;
  const timesPerDay = clampTimesPerDay(patch.timesPerDay ?? current.timesPerDay);
  const timezone = (patch.timezone ?? current.timezone).trim() || DEFAULT_TIMEZONE;

  await pool.query(
    `INSERT INTO aiva_contacts_sync_schedules (
       workspace_id, enabled, times_per_day, timezone, last_run_at, last_result, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       times_per_day = EXCLUDED.times_per_day,
       timezone = EXCLUDED.timezone,
       updated_at = NOW()`,
    [
      workspaceId,
      enabled,
      timesPerDay,
      timezone,
      current.lastRunAt,
      current.lastResult ? JSON.stringify(current.lastResult) : null,
    ],
  );
  return getContactsSyncSchedule(workspaceId);
}

export async function recordContactsSyncRun(
  workspaceId: string,
  result: ContactsSyncLastResult,
): Promise<void> {
  await ensureContactsSyncScheduleSchema();
  const payload = { ...result, at: result.at ?? new Date().toISOString() };
  await pool.query(
    `INSERT INTO aiva_contacts_sync_schedules (
       workspace_id, enabled, times_per_day, timezone, last_run_at, last_result, updated_at
     ) VALUES ($1, TRUE, $2, $3, NOW(), $4::jsonb, NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       last_run_at = NOW(),
       last_result = EXCLUDED.last_result,
       updated_at = NOW()`,
    [workspaceId, DEFAULT_TIMES_PER_DAY, DEFAULT_TIMEZONE, JSON.stringify(payload)],
  );
}

export async function listEnabledContactsSyncSchedules(): Promise<ContactsSyncSchedule[]> {
  await ensureContactsSyncScheduleSchema();
  const result = await pool.query(
    `SELECT workspace_id, enabled, times_per_day, timezone, last_run_at, last_result, updated_at
     FROM aiva_contacts_sync_schedules
     WHERE enabled = TRUE`,
  );
  return result.rows.map((row) => mapRow(row as Record<string, unknown>));
}

export function isContactsSyncDue(schedule: ContactsSyncSchedule, now = new Date()): boolean {
  if (!schedule.enabled) return false;
  if (!schedule.lastRunAt) return true;
  const last = new Date(schedule.lastRunAt).getTime();
  if (Number.isNaN(last)) return true;
  const intervalMs = (24 * 60 * 60 * 1000) / Math.max(1, schedule.timesPerDay);
  return now.getTime() - last >= intervalMs * 0.95;
}
