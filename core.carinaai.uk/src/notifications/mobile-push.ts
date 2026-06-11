import { pool } from '../memory/db.js';
import { getTenantScoutCredentials, scoutServiceUrl } from '../billing/tenant-scout.js';
import { getUserProfile } from '../api/hosted-auth.js';
import { sendExpoPushToTokens } from './expo-push.js';

export type TaskPushStatus = 'completed' | 'failed';

const SCOUT_ALERT_SEVERITIES = new Set(['warning', 'critical', 'breach']);

function isMissingRelationError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '42P01';
}

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

export async function listTaskAlertTokens(tenantId: string): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT expo_push_token
       FROM mobile_push_tokens
       WHERE tenant_id = $1 AND task_alerts = true`,
      [tenantId],
    );
    return result.rows.map((row) => String(row.expo_push_token));
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

export async function listScoutAlertTokens(tenantId: string): Promise<string[]> {
  try {
    const result = await pool.query(
      `SELECT expo_push_token
       FROM mobile_push_tokens
       WHERE tenant_id = $1 AND scout_alerts = true`,
      [tenantId],
    );
    return result.rows.map((row) => String(row.expo_push_token));
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

export async function notifyTaskPush(
  tenantId: string,
  prompt: string,
  status: TaskPushStatus,
): Promise<void> {
  const tokens = await listTaskAlertTokens(tenantId);
  if (tokens.length === 0) return;

  const preview = truncate(prompt);
  const title = status === 'completed' ? 'Carina finished' : 'Carina task failed';
  const body = preview || (status === 'completed' ? 'Your task completed.' : 'Something went wrong.');

  try {
    await sendExpoPushToTokens(tokens, {
      title,
      body,
      sound: 'default',
      channelId: 'carina-tasks',
      data: { screen: 'tasks', status },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[mobile-push] task notify failed:', msg);
  }
}

interface ScoutEventRow {
  id: string;
  severity: string;
  event_type: string;
  description: string;
}

async function fetchScoutEvents(apiKey: string): Promise<ScoutEventRow[]> {
  const base = scoutServiceUrl();
  if (!base) return [];
  const response = await fetch(`${base}/api/events?limit=20`, {
    headers: { 'X-Scout-Key': apiKey },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { events?: ScoutEventRow[] };
  return data.events ?? [];
}

export async function checkScoutAlertsAndPush(tenantId: string): Promise<number> {
  const profile = await getUserProfile(tenantId);
  if (!profile) return 0;

  const creds = await getTenantScoutCredentials(tenantId, profile.email);
  if (!creds) return 0;

  const tokens = await listScoutAlertTokens(tenantId);
  if (tokens.length === 0) return 0;

  const events = await fetchScoutEvents(creds.apiKey);
  const alertEvents = events.filter((event) => SCOUT_ALERT_SEVERITIES.has(event.severity));
  if (alertEvents.length === 0) return 0;

  const watermark = await pool.query(
    'SELECT last_event_id FROM scout_alert_watermarks WHERE tenant_id = $1',
    [tenantId],
  );
  const lastId = watermark.rows[0]?.last_event_id
    ? String(watermark.rows[0].last_event_id)
    : null;

  const newest = alertEvents[0];
  if (!newest || newest.id === lastId) return 0;

  const fresh = lastId
    ? alertEvents.filter((event) => event.id !== lastId).slice(0, 3)
    : alertEvents.slice(0, 1);
  if (fresh.length === 0) return 0;

  const primary = fresh[0];
  const title =
    primary.severity === 'critical' || primary.severity === 'breach'
      ? 'Scout security alert'
      : 'Scout security notice';
  const body = truncate(primary.description || primary.event_type, 120);

  try {
    await sendExpoPushToTokens(tokens, {
      title,
      body,
      sound: 'default',
      channelId: 'carina-scout',
      data: { screen: 'trust', eventId: primary.id },
    });
    await pool.query(
      `INSERT INTO scout_alert_watermarks (tenant_id, last_event_id, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET last_event_id = EXCLUDED.last_event_id, updated_at = NOW()`,
      [tenantId, newest.id],
    );
    return fresh.length;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[mobile-push] scout notify failed:', msg);
    return 0;
  }
}

export async function pollScoutAlertsForAllTenants(): Promise<void> {
  let result;
  try {
    result = await pool.query(
      `SELECT DISTINCT tenant_id
       FROM mobile_push_tokens
       WHERE scout_alerts = true`,
    );
  } catch (err) {
    if (isMissingRelationError(err)) return;
    throw err;
  }
  for (const row of result.rows) {
    const tenantId = String(row.tenant_id);
    try {
      await checkScoutAlertsAndPush(tenantId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[mobile-push] scout poll failed for ${tenantId}:`, msg);
    }
  }
}
