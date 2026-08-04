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

async function responsePercentiles(
  workspaceId: string,
  since: Date,
  until: Date,
): Promise<{ p50: number; p95: number; sampleSize: number }> {
  const result = await pool.query(
    `SELECT
       COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_sec), 0)::float AS p50,
       COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY delta_sec), 0)::float AS p95,
       COUNT(*)::int AS sample_size
     FROM (
       SELECT EXTRACT(EPOCH FROM (
         MIN(sent.created_at) - recv.created_at
       )) AS delta_sec
       FROM ai_worker_activity recv
       JOIN ai_workers w ON w.id = recv.worker_id
       JOIN ai_worker_activity sent ON sent.worker_id = recv.worker_id
         AND sent.action_type = 'message_sent'
         AND sent.created_at > recv.created_at
         AND sent.created_at < recv.created_at + INTERVAL '60 minutes'
       WHERE w.workspace_id = $1
         AND recv.action_type = 'message_received'
         AND recv.created_at >= $2 AND recv.created_at < $3
       GROUP BY recv.id
     ) pairs`,
    [workspaceId, since, until],
  );
  const row = result.rows[0] as { p50?: number; p95?: number; sample_size?: number } | undefined;
  return {
    p50: Math.round(Number(row?.p50 ?? 0)),
    p95: Math.round(Number(row?.p95 ?? 0)),
    sampleSize: Number(row?.sample_size ?? 0),
  };
}

export async function queryAnalyticsSummary(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const [
    totalConversations,
    prevConversations,
    messagesFromAiva,
    prevAivaMessages,
    escRate,
    prevEscRate,
    avgSec,
    prevAvgSec,
    percentiles,
  ] = await Promise.all([
    countConversations(workspaceId, win.since, win.until),
    countConversations(workspaceId, win.prevSince, win.prevUntil),
    countAivaMessages(workspaceId, win.since, win.until),
    countAivaMessages(workspaceId, win.prevSince, win.prevUntil),
    escalationRate(workspaceId, win.since, win.until),
    escalationRate(workspaceId, win.prevSince, win.prevUntil),
    avgResponseSec(workspaceId, win.since, win.until),
    avgResponseSec(workspaceId, win.prevSince, win.prevUntil),
    responsePercentiles(workspaceId, win.since, win.until),
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
    responseP50Sec: percentiles.p50,
    responseP95Sec: percentiles.p95,
    responseSampleSize: percentiles.sampleSize,
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
    `SELECT t.channel,
            COUNT(*)::int AS threads,
            COALESCE(SUM(COALESCE(t.message_count, 0)), 0)::int AS messages
     FROM channel_threads t
     JOIN ai_workers w ON w.id = t.worker_id
     WHERE w.workspace_id = $1
       AND t.last_message_at >= $2 AND t.last_message_at < $3
     GROUP BY t.channel
     ORDER BY messages DESC, threads DESC`,
    [workspaceId, win.since, win.until],
  );
  const rows = result.rows.map((row) => ({
    channel: String(row.channel),
    threads: Number(row.threads),
    messages: Number(row.messages),
    count: Number(row.messages) || Number(row.threads),
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

/** Inbound vs outbound message activity by day. */
export async function queryAnalyticsDirection(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const result = await pool.query(
    `SELECT d::date AS day,
            COALESCE(v.inbound, 0)::int AS inbound,
            COALESCE(v.outbound, 0)::int AS outbound
     FROM generate_series($2::date, $3::date, '1 day') d
     LEFT JOIN (
       SELECT DATE(a.created_at) AS day,
              COUNT(*) FILTER (WHERE a.action_type = 'message_received')::int AS inbound,
              COUNT(*) FILTER (WHERE a.action_type = 'message_sent')::int AS outbound
       FROM ai_worker_activity a
       JOIN ai_workers w ON w.id = a.worker_id
       WHERE w.workspace_id = $1
         AND a.created_at >= $2 AND a.created_at < $4
         AND a.action_type IN ('message_received', 'message_sent')
       GROUP BY DATE(a.created_at)
     ) v ON v.day = d::date
     ORDER BY day ASC`,
    [workspaceId, win.since, win.until, win.until],
  );
  const points = result.rows.map((row) => ({
    date: String(row.day).slice(0, 10),
    inbound: Number(row.inbound),
    outbound: Number(row.outbound),
  }));
  const inbound = points.reduce((s, p) => s + p.inbound, 0);
  const outbound = points.reduce((s, p) => s + p.outbound, 0);
  return {
    points,
    totals: { inbound, outbound },
    mix: [
      { name: 'Inbound', value: inbound },
      { name: 'Outbound', value: outbound },
    ],
  };
}

/** Email + social approval queue health for the period + live pending. */
export async function queryAnalyticsApprovals(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);
  const [emailPeriod, socialPeriod, emailPending, socialPending] = await Promise.all([
    pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM worker_email_approvals
       WHERE workspace_id = $1
         AND requested_at >= $2 AND requested_at < $3
       GROUP BY status`,
      [workspaceId, win.since, win.until],
    ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
    pool.query(
      `SELECT status, COUNT(*)::int AS count
       FROM worker_social_approvals
       WHERE workspace_id = $1
         AND requested_at >= $2 AND requested_at < $3
       GROUP BY status`,
      [workspaceId, win.since, win.until],
    ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM worker_email_approvals
       WHERE workspace_id = $1 AND status = 'pending'`,
      [workspaceId],
    ).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM worker_social_approvals
       WHERE workspace_id = $1 AND status = 'pending'`,
      [workspaceId],
    ).catch(() => ({ rows: [{ count: 0 }] })),
  ]);

  const byStatus: Record<string, number> = {
    pending: 0,
    approved: 0,
    rejected: 0,
    timeout: 0,
    sent: 0,
  };
  for (const row of [...emailPeriod.rows, ...socialPeriod.rows]) {
    const key = String(row.status);
    byStatus[key] = (byStatus[key] ?? 0) + Number(row.count ?? 0);
  }

  const pendingNow = Number(emailPending.rows[0]?.count ?? 0) + Number(socialPending.rows[0]?.count ?? 0);
  const donut = Object.entries(byStatus)
    .filter(([, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  return {
    pendingNow,
    emailPending: Number(emailPending.rows[0]?.count ?? 0),
    socialPending: Number(socialPending.rows[0]?.count ?? 0),
    byStatus,
    donut,
  };
}

/** Escalation lifecycle from ai_worker_escalations (not just activity.escalated). */
export async function queryAnalyticsEscalationLifecycle(
  workspaceId: string,
  period: AnalyticsPeriod,
) {
  const win = periodWindow(period);
  const [statusRows, openNow, trend] = await Promise.all([
    pool.query(
      `SELECT e.status, COUNT(*)::int AS count
       FROM ai_worker_escalations e
       JOIN ai_workers w ON w.id = e.worker_id
       WHERE e.workspace_id = $1
         AND w.workspace_id = $1
         AND e.created_at >= $2 AND e.created_at < $3
       GROUP BY e.status`,
      [workspaceId, win.since, win.until],
    ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ai_worker_escalations e
       JOIN ai_workers w ON w.id = e.worker_id
       WHERE e.workspace_id = $1
         AND w.status != 'dismissed'
         AND e.status = 'open'`,
      [workspaceId],
    ).catch(() => ({ rows: [{ count: 0 }] })),
    pool.query(
      `SELECT d::date AS day,
              COALESCE(v.opened, 0)::int AS opened,
              COALESCE(v.resolved, 0)::int AS resolved
       FROM generate_series($2::date, $3::date, '1 day') d
       LEFT JOIN (
         SELECT DATE(e.created_at) AS day,
                COUNT(*)::int AS opened,
                COUNT(*) FILTER (WHERE e.status = 'resolved')::int AS resolved
         FROM ai_worker_escalations e
         WHERE e.workspace_id = $1
           AND e.created_at >= $2 AND e.created_at < $4
         GROUP BY DATE(e.created_at)
       ) v ON v.day = d::date
       ORDER BY day ASC`,
      [workspaceId, win.since, win.until, win.until],
    ).catch(() => ({ rows: [] as Array<{ day: string; opened: number; resolved: number }> })),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of statusRows.rows) {
    byStatus[String(row.status)] = Number(row.count ?? 0);
  }
  const donut = Object.entries(byStatus).map(([name, value]) => ({ name, value }));

  return {
    openNow: Number(openNow.rows[0]?.count ?? 0),
    byStatus,
    donut,
    points: trend.rows.map((row) => ({
      date: String(row.day).slice(0, 10),
      opened: Number(row.opened),
      resolved: Number(row.resolved),
    })),
  };
}

/** Plan message usage vs limit for the current billing month. */
export async function queryAnalyticsUsage(workspaceId: string) {
  const { getCurrentUsage, messageLimit } = await import('../usage/usage-service.js');
  const { getSubscription } = await import('../workers/aiva-subscription-store.js');
  const [usage, sub] = await Promise.all([
    getCurrentUsage(workspaceId),
    getSubscription(workspaceId),
  ]);
  const planTier = String(sub?.planTier ?? 'trial');
  const limit = messageLimit(planTier);
  const finite = Number.isFinite(limit);
  const pct = finite && limit > 0 ? Math.min(100, Math.round((usage.messageCount / limit) * 1000) / 10) : 0;
  return {
    month: usage.month,
    messageCount: usage.messageCount,
    messageLimit: finite ? limit : null,
    unlimited: !finite,
    planTier,
    pctUsed: pct,
  };
}

/** Combined Phase 1 ops payload for the analytics dashboard. */
export async function queryAnalyticsOps(workspaceId: string, period: AnalyticsPeriod) {
  const [direction, approvals, escalationLifecycle, usage, channels] = await Promise.all([
    queryAnalyticsDirection(workspaceId, period),
    queryAnalyticsApprovals(workspaceId, period),
    queryAnalyticsEscalationLifecycle(workspaceId, period),
    queryAnalyticsUsage(workspaceId),
    queryAnalyticsChannels(workspaceId, period),
  ]);
  return {
    period,
    direction,
    approvals,
    escalationLifecycle,
    usage,
    channels,
  };
}

function softDonut(rows: Array<{ status?: string; category?: string; count?: number; key?: string }>): Array<{ name: string; value: number }> {
  return rows
    .map((row) => ({
      name: String(row.status ?? row.category ?? row.key ?? 'unknown'),
      value: Number(row.count ?? 0),
    }))
    .filter((row) => row.value > 0);
}

/** Core-side admin domains: projects, human assist, Drive ops, contacts sync meta. */
export async function queryAnalyticsAdmin(workspaceId: string, period: AnalyticsPeriod) {
  const win = periodWindow(period);

  const [projectsStatus, projectItems, assistStatus, assistUrgency, assistOpen, driveCategory, driveSync, driveSyncRuns, contactIdentities, contactsSchedule] =
    await Promise.all([
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM aiva_projects
         WHERE workspace_id = $1
         GROUP BY status`,
        [workspaceId],
      ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM aiva_project_items i
         JOIN aiva_projects p ON p.id = i.project_id
         WHERE p.workspace_id = $1
           AND i.created_at >= $2 AND i.created_at < $3`,
        [workspaceId, win.since, win.until],
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT status, COUNT(*)::int AS count
         FROM aiva_human_assist_requests
         WHERE workspace_id = $1
           AND created_at >= $2 AND created_at < $3
         GROUP BY status`,
        [workspaceId, win.since, win.until],
      ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
      pool.query(
        `SELECT urgency, COUNT(*)::int AS count
         FROM aiva_human_assist_requests
         WHERE workspace_id = $1
           AND created_at >= $2 AND created_at < $3
         GROUP BY urgency`,
        [workspaceId, win.since, win.until],
      ).catch(() => ({ rows: [] as Array<{ urgency: string; count: number }> })),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM aiva_human_assist_requests
         WHERE workspace_id = $1
           AND status IN ('queued', 'assigned', 'in_progress')`,
        [workspaceId],
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT category, COUNT(*)::int AS count
         FROM aiva_workspace_ops_mappings
         WHERE workspace_id = $1
           AND COALESCE(sync_status, '') != 'deleted'
         GROUP BY category`,
        [workspaceId],
      ).catch(() => ({ rows: [] as Array<{ category: string; count: number }> })),
      pool.query(
        `SELECT sync_status AS status, COUNT(*)::int AS count
         FROM aiva_workspace_ops_mappings
         WHERE workspace_id = $1
           AND COALESCE(sync_status, '') != 'deleted'
         GROUP BY sync_status`,
        [workspaceId],
      ).catch(() => ({ rows: [] as Array<{ status: string; count: number }> })),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM aiva_workspace_ops_sync_runs
         WHERE workspace_id = $1
           AND started_at >= $2 AND started_at < $3`,
        [workspaceId, win.since, win.until],
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT COUNT(*)::int AS count
         FROM aiva_contact_identities
         WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(
        `SELECT last_run_at, last_result
         FROM aiva_contacts_sync_schedules
         WHERE workspace_id = $1`,
        [workspaceId],
      ).catch(() => ({ rows: [] as Array<{ last_run_at: Date | null; last_result: unknown }> })),
    ]);

  const categoryRows = driveCategory.rows as Array<{ category: string; count: number }>;
  const attendance = Number(categoryRows.find((r) => r.category === 'attendance')?.count ?? 0);
  const minutes = Number(categoryRows.find((r) => r.category === 'minutes')?.count ?? 0);
  const schedule = contactsSchedule.rows[0] as
    | { last_run_at?: Date | null; last_result?: { imported?: number; skipped?: number; ok?: boolean } | null }
    | undefined;

  return {
    period,
    projects: {
      total: projectsStatus.rows.reduce((s, r) => s + Number((r as { count: number }).count ?? 0), 0),
      byStatus: softDonut(projectsStatus.rows as Array<{ status: string; count: number }>),
      items: Number(projectItems.rows[0]?.count ?? 0),
    },
    humanAssist: {
      total: assistStatus.rows.reduce((s, r) => s + Number((r as { count: number }).count ?? 0), 0),
      open: Number(assistOpen.rows[0]?.count ?? 0),
      byStatus: softDonut(assistStatus.rows as Array<{ status: string; count: number }>),
      byUrgency: softDonut(
        (assistUrgency.rows as Array<{ urgency: string; count: number }>).map((r) => ({
          status: r.urgency,
          count: r.count,
        })),
      ),
    },
    driveOps: {
      mappings: categoryRows.reduce((s, r) => s + Number(r.count ?? 0), 0),
      attendance,
      minutes,
      byCategory: softDonut(categoryRows.map((r) => ({ category: r.category, count: r.count }))),
      bySyncStatus: softDonut(driveSync.rows as Array<{ status: string; count: number }>),
      recentSyncs: Number(driveSyncRuns.rows[0]?.count ?? 0),
    },
    contacts: {
      identities: Number(contactIdentities.rows[0]?.count ?? 0),
      lastSyncAt: schedule?.last_run_at ? new Date(schedule.last_run_at).toISOString() : null,
      lastImport: schedule?.last_result ?? null,
    },
  };
}

