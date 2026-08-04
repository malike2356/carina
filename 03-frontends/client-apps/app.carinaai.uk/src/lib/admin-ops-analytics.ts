import 'server-only';

import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  calendarEvents,
  documents,
  emailMessages,
  researchJobs,
  scheduledTasks,
  taskRuns,
} from '@/db/schema';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

export type AdminOpsPeriod = '7d' | '30d' | '90d';

export function parseAdminOpsPeriod(raw: string | null): AdminOpsPeriod {
  if (raw === '7d' || raw === '90d') return raw;
  return '30d';
}

function periodWindow(period: AdminOpsPeriod): { since: Date; until: Date; days: number } {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const until = new Date();
  const since = new Date(until.getTime() - days * 86_400_000);
  return { since, until, days };
}

function fillDailySeries(
  since: Date,
  until: Date,
  rows: Array<{ day: string; count: number }>,
): Array<{ date: string; count: number }> {
  const map = new Map(rows.map((r) => [String(r.day).slice(0, 10), Number(r.count) || 0]));
  const out: Array<{ date: string; count: number }> = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  const end = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate()));
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ date: key, count: map.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function fillTaskSeries(
  since: Date,
  until: Date,
  rows: Array<{ day: string; completed: number; failed: number }>,
): Array<{ date: string; completed: number; failed: number }> {
  const map = new Map(
    rows.map((r) => [
      String(r.day).slice(0, 10),
      { completed: Number(r.completed) || 0, failed: Number(r.failed) || 0 },
    ]),
  );
  const out: Array<{ date: string; completed: number; failed: number }> = [];
  const cursor = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
  const end = new Date(Date.UTC(until.getUTCFullYear(), until.getUTCMonth(), until.getUTCDate()));
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    const hit = map.get(key) ?? { completed: 0, failed: 0 };
    out.push({ date: key, ...hit });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function rowsToDonut(rows: Array<{ key: string; count: number }>): Array<{ name: string; value: number }> {
  return rows
    .filter((r) => r.count > 0)
    .map((r) => ({ name: r.key, value: r.count }));
}

async function queryEmail(workspaceId: string, since: Date, until: Date) {
  const wherePeriod = and(
    eq(emailMessages.workspaceId, workspaceId),
    gte(emailMessages.receivedAt, since),
    lt(emailMessages.receivedAt, until),
  );

  const [totals, byStatus, byUrgency, daily] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(emailMessages)
      .where(wherePeriod),
    db
      .select({
        key: emailMessages.status,
        count: sql<number>`count(*)::int`,
      })
      .from(emailMessages)
      .where(wherePeriod)
      .groupBy(emailMessages.status),
    db
      .select({
        key: emailMessages.urgency,
        count: sql<number>`count(*)::int`,
      })
      .from(emailMessages)
      .where(wherePeriod)
      .groupBy(emailMessages.urgency),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${emailMessages.receivedAt}), 'YYYY-MM-DD')`,
        count: sql<number>`count(*)::int`,
      })
      .from(emailMessages)
      .where(wherePeriod)
      .groupBy(sql`date_trunc('day', ${emailMessages.receivedAt})`)
      .catch(() => [] as Array<{ day: string; count: number }>),
  ]);

  return {
    total: Number(totals[0]?.count ?? 0),
    byStatus: rowsToDonut(byStatus.map((r) => ({ key: String(r.key), count: Number(r.count) }))),
    byUrgency: rowsToDonut(byUrgency.map((r) => ({ key: String(r.key), count: Number(r.count) }))),
    points: fillDailySeries(
      since,
      until,
      (daily as Array<{ day: string; count: number }>).map((r) => ({
        day: String(r.day),
        count: Number(r.count),
      })),
    ),
  };
}

async function queryDocuments(workspaceId: string, since: Date, until: Date) {
  const [created, updated, active] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          gte(documents.createdAt, since),
          lt(documents.createdAt, until),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(
        and(
          eq(documents.workspaceId, workspaceId),
          gte(documents.updatedAt, since),
          lt(documents.updatedAt, until),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(eq(documents.workspaceId, workspaceId), eq(documents.archived, false))),
  ]);

  return {
    created: Number(created[0]?.count ?? 0),
    updated: Number(updated[0]?.count ?? 0),
    active: Number(active[0]?.count ?? 0),
  };
}

async function queryCalendar(workspaceId: string, since: Date, until: Date) {
  const [inWindow, created] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.workspaceId, workspaceId),
          gte(calendarEvents.startsAt, since),
          lt(calendarEvents.startsAt, until),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.workspaceId, workspaceId),
          gte(calendarEvents.createdAt, since),
          lt(calendarEvents.createdAt, until),
        ),
      ),
  ]);

  return {
    eventsInPeriod: Number(inWindow[0]?.count ?? 0),
    createdInPeriod: Number(created[0]?.count ?? 0),
  };
}

async function queryResearch(workspaceId: string, since: Date, until: Date) {
  const [total, byStatus] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(researchJobs)
      .where(
        and(
          eq(researchJobs.workspaceId, workspaceId),
          gte(researchJobs.createdAt, since),
          lt(researchJobs.createdAt, until),
        ),
      ),
    db
      .select({
        key: researchJobs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(researchJobs)
      .where(
        and(
          eq(researchJobs.workspaceId, workspaceId),
          gte(researchJobs.createdAt, since),
          lt(researchJobs.createdAt, until),
        ),
      )
      .groupBy(researchJobs.status),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [String(r.key), Number(r.count)]),
  );

  return {
    total: Number(total[0]?.count ?? 0),
    completed: statusMap.completed ?? 0,
    failed: statusMap.failed ?? 0,
    running: (statusMap.running ?? 0) + (statusMap.queued ?? 0),
    byStatus: rowsToDonut(byStatus.map((r) => ({ key: String(r.key), count: Number(r.count) }))),
  };
}

async function queryTasks(workspaceId: string, since: Date, until: Date) {
  const wherePeriod = and(
    eq(taskRuns.workspaceId, workspaceId),
    gte(taskRuns.createdAt, since),
    lt(taskRuns.createdAt, until),
  );

  const [runsByStatus, taskCount, daily] = await Promise.all([
    db
      .select({
        key: taskRuns.status,
        count: sql<number>`count(*)::int`,
      })
      .from(taskRuns)
      .where(wherePeriod)
      .groupBy(taskRuns.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(scheduledTasks)
      .where(eq(scheduledTasks.workspaceId, workspaceId)),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${taskRuns.createdAt}), 'YYYY-MM-DD')`,
        completed: sql<number>`count(*) FILTER (WHERE ${taskRuns.status} = 'completed')::int`,
        failed: sql<number>`count(*) FILTER (WHERE ${taskRuns.status} = 'failed')::int`,
      })
      .from(taskRuns)
      .where(wherePeriod)
      .groupBy(sql`date_trunc('day', ${taskRuns.createdAt})`)
      .catch(() => [] as Array<{ day: string; completed: number; failed: number }>),
  ]);

  const statusMap = Object.fromEntries(
    runsByStatus.map((r) => [String(r.key), Number(r.count)]),
  );

  return {
    scheduledTasks: Number(taskCount[0]?.count ?? 0),
    completed: statusMap.completed ?? 0,
    failed: statusMap.failed ?? 0,
    running: statusMap.running ?? 0,
    byStatus: rowsToDonut(runsByStatus.map((r) => ({ key: String(r.key), count: Number(r.count) }))),
    points: fillTaskSeries(
      since,
      until,
      (daily as Array<{ day: string; completed: number; failed: number }>).map((r) => ({
        day: String(r.day),
        completed: Number(r.completed),
        failed: Number(r.failed),
      })),
    ),
  };
}

async function queryCoreAdmin(
  workspaceId: string,
  period: AdminOpsPeriod,
): Promise<Record<string, unknown> | null> {
  try {
    const upstream = await proxyAivaRequest(
      workspaceId,
      `/api/analytics/admin?period=${period}`,
      { method: 'GET' },
    );
    if (!upstream.ok) return null;
    return (await upstream.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function buildAdminOpsAnalytics(
  workspaceId: string,
  period: AdminOpsPeriod,
): Promise<Record<string, unknown>> {
  const { since, until, days } = periodWindow(period);

  const [email, docs, calendar, research, tasks, core] = await Promise.all([
    queryEmail(workspaceId, since, until).catch((err) => {
      console.error('[admin-ops] email query failed', err);
      return { total: 0, byStatus: [] as Array<{ name: string; value: number }>, byUrgency: [] as Array<{ name: string; value: number }>, points: [] as Array<{ date: string; count: number }> };
    }),
    queryDocuments(workspaceId, since, until).catch((err) => {
      console.error('[admin-ops] documents query failed', err);
      return { created: 0, updated: 0, active: 0 };
    }),
    queryCalendar(workspaceId, since, until).catch((err) => {
      console.error('[admin-ops] calendar query failed', err);
      return { eventsInPeriod: 0, createdInPeriod: 0 };
    }),
    queryResearch(workspaceId, since, until).catch((err) => {
      console.error('[admin-ops] research query failed', err);
      return { total: 0, completed: 0, failed: 0, running: 0, byStatus: [] as Array<{ name: string; value: number }> };
    }),
    queryTasks(workspaceId, since, until).catch((err) => {
      console.error('[admin-ops] tasks query failed', err);
      return {
        scheduledTasks: 0,
        completed: 0,
        failed: 0,
        running: 0,
        byStatus: [] as Array<{ name: string; value: number }>,
        points: [] as Array<{ date: string; completed: number; failed: number }>,
      };
    }),
    queryCoreAdmin(workspaceId, period),
  ]);

  return {
    period,
    days,
    email,
    documents: docs,
    calendar,
    research,
    tasks,
    projects: core?.projects ?? { total: 0, byStatus: [], items: 0 },
    humanAssist: core?.humanAssist ?? { total: 0, open: 0, byStatus: [], byUrgency: [] },
    driveOps: core?.driveOps ?? {
      mappings: 0,
      attendance: 0,
      minutes: 0,
      byCategory: [],
      bySyncStatus: [],
      recentSyncs: 0,
    },
    contacts: core?.contacts ?? { identities: 0, lastSyncAt: null, lastImport: null },
  };
}
