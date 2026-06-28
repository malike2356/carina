import { pool } from '../memory/db.js';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export function parseAnalyticsPeriod(raw: unknown): AnalyticsPeriod {
  if (raw === '7d' || raw === '90d') return raw;
  return '30d';
}

function periodDays(period: AnalyticsPeriod): number {
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

export function periodWindow(period: AnalyticsPeriod): {
  days: number;
  since: Date;
  until: Date;
  prevSince: Date;
  prevUntil: Date;
} {
  const days = periodDays(period);
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  const prevUntil = since;
  const prevSince = new Date(prevUntil.getTime() - days * 86_400_000);
  return { days, since, until, prevSince, prevUntil };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

async function countConversations(workspaceId: string, since: Date, until: Date): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE w.workspace_id = $1
       AND t.last_message_at >= $2 AND t.last_message_at < $3`,
    [workspaceId, since, until],
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function countAivaMessages(workspaceId: string, since: Date, until: Date): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE w.workspace_id = $1
       AND a.action_type = 'message_sent'
       AND a.created_at >= $2 AND a.created_at < $3`,
    [workspaceId, since, until],
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function escalationRate(workspaceId: string, since: Date, until: Date): Promise<number> {
  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE a.escalated = true)::int AS escalated,
       COUNT(*)::int AS total
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE w.workspace_id = $1
       AND a.created_at >= $2 AND a.created_at < $3
       AND a.action_type IN ('message_received', 'message_sent')`,
    [workspaceId, since, until],
  );
  const row = result.rows[0] as { escalated?: number; total?: number } | undefined;
  const total = Number(row?.total ?? 0);
  if (total === 0) return 0;
  return Number(row?.escalated ?? 0) / total;
}

async function avgResponseSec(
  workspaceId: string,
  since: Date,
  until: Date,
  workerId?: string,
): Promise<number> {
  const workerClause = workerId ? 'AND recv.worker_id = $4' : '';
  const params: unknown[] = workerId
    ? [workspaceId, since, until, workerId]
    : [workspaceId, since, until];
  const result = await pool.query(
    `SELECT AVG(delta_sec)::float AS avg_sec
     FROM (
       SELECT EXTRACT(EPOCH FROM (
         MIN(sent.created_at) - recv.created_at
       )) AS delta_sec
       FROM ai_worker_activity recv
       JOIN ai_workers w ON w.id = recv.worker_id
       JOIN ai_worker_activity sent ON sent.worker_id = recv.worker_id
         AND sent.action_type = 'message_sent'
         AND sent.created_at > recv.created_at
         AND sent.created_at < recv.created_at + INTERVAL '15 minutes'
       WHERE w.workspace_id = $1
         AND recv.action_type = 'message_received'
         AND recv.created_at >= $2 AND recv.created_at < $3
         ${workerClause}
       GROUP BY recv.id
     ) pairs`,
    params,
  );
  const avg = Number(result.rows[0]?.avg_sec ?? 0);
  return Number.isFinite(avg) ? Math.round(avg) : 0;
}

export async function queryAnalyticsSummary(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const [totalConversations, prevConversations, messagesFromAiva, prevAivaMessages, escRate, prevEscRate, avgSec, prevAvgSec] =
    await Promise.all([
      countConversations(workspaceId, win.since, win.until),
      countConversations(workspaceId, win.prevSince, win.prevUntil),
      countAivaMessages(workspaceId, win.since, win.until),
      countAivaMessages(workspaceId, win.prevSince, win.prevUntil),
      escalationRate(workspaceId, win.since, win.until),
      escalationRate(workspaceId, win.prevSince, win.prevUntil),
      avgResponseSec(workspaceId, win.since, win.until),
      avgResponseSec(workspaceId, win.prevSince, win.prevUntil),
    ]);

  return {
    period,
    totalConversations,
    prevPeriodCount: prevConversations,
    totalConversationsTrend: pctChange(totalConversations, prevConversations),
    messagesFromAiva,
    prevPeriodAivaCount: prevAivaMessages,
    messagesFromAivaTrend: pctChange(messagesFromAiva, prevAivaMessages),
    escalationRate: escRate,
    prevPeriodEscalationRate: prevEscRate,
    escalationRateTrend: pctChange(escRate, prevEscRate),
    avgResponseSec: avgSec,
    prevPeriodAvgResponseSec: prevAvgSec,
    avgResponseSecTrend: pctChange(avgSec, prevAvgSec),
  };
}

export async function queryAnalyticsVolume(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT d::date AS day, COALESCE(v.cnt, 0)::int AS count
     FROM generate_series($2::date, $3::date, '1 day') d
     LEFT JOIN (
       SELECT DATE(a.created_at) AS day, COUNT(*)::int AS cnt
       FROM ai_worker_activity a
       JOIN ai_workers w ON w.id = a.worker_id
       WHERE w.workspace_id = $1
         AND a.created_at >= $2 AND a.created_at < $4
       GROUP BY DATE(a.created_at)
     ) v ON v.day = d::date
     ORDER BY day ASC`,
    [workspaceId, win.since, win.until, win.until],
  );
  return result.rows.map((row) => ({
    date: String(row.day).slice(0, 10),
    count: Number(row.count),
  }));
}

export async function queryAnalyticsChannels(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT t.channel, COUNT(*)::int AS count
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE w.workspace_id = $1
       AND t.last_message_at >= $2 AND t.last_message_at < $3
     GROUP BY t.channel
     ORDER BY count DESC`,
    [workspaceId, win.since, win.until],
  );
  const rows = result.rows.map((row) => ({
    channel: String(row.channel),
    count: Number(row.count),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  return rows.map((row) => ({
    ...row,
    pct: Math.round((row.count / total) * 1000) / 10,
  }));
}

export async function queryAnalyticsEscalations(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT d::date AS day,
            COALESCE(v.total, 0)::int AS total,
            COALESCE(v.escalated, 0)::int AS escalated
     FROM generate_series($2::date, $3::date, '1 day') d
     LEFT JOIN (
       SELECT DATE(a.created_at) AS day,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE a.escalated = true)::int AS escalated
       FROM ai_worker_activity a
       JOIN ai_workers w ON w.id = a.worker_id
       WHERE w.workspace_id = $1
         AND a.created_at >= $2 AND a.created_at < $4
       GROUP BY DATE(a.created_at)
     ) v ON v.day = d::date
     ORDER BY day ASC`,
    [workspaceId, win.since, win.until, win.until],
  );
  return result.rows.map((row) => {
    const total = Number(row.total);
    const escalated = Number(row.escalated);
    return {
      date: String(row.day).slice(0, 10),
      total,
      escalated,
      rate: total > 0 ? escalated / total : 0,
    };
  });
}

export async function queryAnalyticsHeatmap(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT
       CASE WHEN EXTRACT(DOW FROM a.created_at AT TIME ZONE 'UTC')::int = 0 THEN 6
            ELSE EXTRACT(DOW FROM a.created_at AT TIME ZONE 'UTC')::int - 1 END AS day_of_week,
       EXTRACT(HOUR FROM a.created_at AT TIME ZONE 'UTC')::int AS hour,
       COUNT(*)::int AS count
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE w.workspace_id = $1 AND a.created_at >= $2 AND a.created_at < $3
     GROUP BY 1, 2
     HAVING COUNT(*) > 0`,
    [workspaceId, win.since, win.until],
  );
  return result.rows.map((row) => ({
    dayOfWeek: Number(row.day_of_week),
    hour: Number(row.hour),
    count: Number(row.count),
  }));
}

export async function queryAnalyticsAivaBreakdown(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT w.id AS worker_id, w.name AS worker_name,
            COUNT(*) FILTER (WHERE a.action_type = 'message_sent')::int AS message_count,
            COUNT(*) FILTER (WHERE a.escalated = true)::int AS escalation_count
     FROM ai_workers w
     LEFT JOIN ai_worker_activity a ON a.worker_id = w.id
       AND a.created_at >= $2 AND a.created_at < $3
     WHERE w.workspace_id = $1 AND w.status != 'dismissed'
     GROUP BY w.id, w.name
     ORDER BY message_count DESC`,
    [workspaceId, win.since, win.until],
  );

  const breakdown = await Promise.all(
    result.rows.map(async (row) => ({
      workerId: String(row.worker_id),
      workerName: String(row.worker_name),
      messageCount: Number(row.message_count ?? 0),
      escalationCount: Number(row.escalation_count ?? 0),
      avgResponseSec: await avgResponseSec(
        workspaceId,
        win.since,
        win.until,
        String(row.worker_id),
      ),
    })),
  );
  return breakdown;
}
