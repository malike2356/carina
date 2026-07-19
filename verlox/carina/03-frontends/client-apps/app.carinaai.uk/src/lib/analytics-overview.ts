import 'server-only';

import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  calendarEvents,
  chatMessages,
  chatSessions,
  documents,
  emailMessages,
  researchJobs,
  scheduledTasks,
  taskRuns,
  usageEvents,
  userMemories,
  userNotes,
  workspaceSkills,
} from '@/db/schema';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import type {
  AnalyticsAivaOverview,
  AnalyticsBreakdownRow,
  AnalyticsBusinessOverview,
  AnalyticsOverview,
  AnalyticsSeriesPoint,
  AnalyticsSessionRow,
} from '@/lib/analytics-types';

function startOfDay(days: number): Date {
  const now = new Date();
  const since = new Date(now.getTime() - Math.max(days, 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);
  return since;
}

function classifySessionStatus(lastMessageAt: string | null): 'active' | 'idle' | 'stale' {
  if (!lastMessageAt) return 'stale';
  const age = Date.now() - new Date(lastMessageAt).getTime();
  if (age < 10 * 60_000) return 'active';
  if (age < 60 * 60_000) return 'idle';
  return 'stale';
}

function normalizeLabel(value: string | null | undefined, fallback: string): string {
  const label = value?.trim() ?? '';
  return label.length > 0 ? label : fallback;
}

function estimateCostGbp(tokens: number): number {
  return (tokens / 1000) * 0.002;
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function toPeriod(days: number): '7d' | '30d' | '90d' {
  if (days <= 7) return '7d';
  if (days >= 90) return '90d';
  return '30d';
}

function emptyAivaOverview(): AnalyticsAivaOverview {
  return {
    available: false,
    gated: false,
    summary: {
      totalConversations: 0,
      messagesFromAiva: 0,
      escalationRate: 0,
      avgResponseSec: 0,
    },
    volume: [],
    channels: [],
    escalations: [],
    heatmap: [],
    workers: [],
  };
}

function rowsFromExecute<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const rows = (value as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? rows as T[] : [];
}

async function fetchCoreJson<T>(
  workspaceId: string,
  path: string,
): Promise<{ data: T | null; status: number }> {
  if (!coreProxyEnabled()) return { data: null, status: 503 };

  const token = resolveCoreProxyToken();
  const response = await fetch(`${resolveCoreUrl().replace(/\/$/, '')}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-internal-key': token,
      'x-workspace-id': workspaceId,
    },
    cache: 'no-store',
  });

  if (!response.ok) return { data: null, status: response.status };
  return { data: await response.json() as T, status: response.status };
}

async function loadAivaOverview(workspaceId: string, days: number): Promise<AnalyticsAivaOverview> {
  if (!coreProxyEnabled()) return emptyAivaOverview();
  const period = toPeriod(days);

  try {
    const [summaryRes, volumeRes, channelsRes, escalationsRes, heatmapRes, workersRes] = await Promise.all([
      fetchCoreJson<{
        totalConversations?: number;
        messagesFromAiva?: number;
        escalationRate?: number;
        avgResponseSec?: number;
      }>(workspaceId, `/api/analytics/summary?period=${period}`),
      fetchCoreJson<{ points?: Array<{ date: string; count: number }> }>(
        workspaceId,
        `/api/analytics/volume?period=${period}`,
      ),
      fetchCoreJson<{ channels?: AnalyticsAivaOverview['channels'] }>(
        workspaceId,
        `/api/analytics/channels?period=${period}`,
      ),
      fetchCoreJson<{ points?: AnalyticsAivaOverview['escalations'] }>(
        workspaceId,
        `/api/analytics/escalations?period=${period}`,
      ),
      fetchCoreJson<{ cells?: AnalyticsAivaOverview['heatmap'] }>(
        workspaceId,
        `/api/analytics/heatmap?period=${period}`,
      ),
      fetchCoreJson<{ workers?: AnalyticsAivaOverview['workers'] }>(
        workspaceId,
        `/api/analytics/aiva-breakdown?period=${period}`,
      ),
    ]);

    const teamGated = [channelsRes, escalationsRes, heatmapRes, workersRes].some((res) => res.status === 402 || res.status === 403);
    return {
      available: Boolean(summaryRes.data || volumeRes.data),
      gated: teamGated,
      summary: {
        totalConversations: Number(summaryRes.data?.totalConversations ?? 0),
        messagesFromAiva: Number(summaryRes.data?.messagesFromAiva ?? 0),
        escalationRate: Number(summaryRes.data?.escalationRate ?? 0),
        avgResponseSec: Number(summaryRes.data?.avgResponseSec ?? 0),
      },
      volume: volumeRes.data?.points ?? [],
      channels: channelsRes.data?.channels ?? [],
      escalations: escalationsRes.data?.points ?? [],
      heatmap: heatmapRes.data?.cells ?? [],
      workers: workersRes.data?.workers ?? [],
    };
  } catch {
    return emptyAivaOverview();
  }
}

function metric(current: number, previous: number) {
  return { current, previous, changePct: pctChange(current, previous) };
}

async function loadBusinessOverview(workspaceId: string, days: number, since: Date): Promise<AnalyticsBusinessOverview> {
  const previousSince = new Date(since.getTime() - days * 86_400_000);
  const now = new Date();
  const sinceIso = since.toISOString();
  const previousSinceIso = previousSince.toISOString();
  const nowIso = now.toISOString();

  const [
    moduleRows,
    previousRows,
    activityRows,
    meetingSources,
    scheduleRows,
    scheduleRunRows,
    contentRows,
    emailRows,
    researchRows,
  ] = await Promise.all([
    db.execute(sql`
      SELECT 'Messages' AS label, COUNT(*)::int AS value FROM chat_messages WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Usage events', COUNT(*)::int FROM usage_events WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Meetings', COUNT(*)::int FROM calendar_events WHERE workspace_id = ${workspaceId} AND starts_at >= ${sinceIso}
      UNION ALL SELECT 'Documents', COUNT(*)::int FROM documents WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Schedules', COUNT(*)::int FROM scheduled_tasks WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Emails', COUNT(*)::int FROM email_messages WHERE workspace_id = ${workspaceId} AND received_at >= ${sinceIso}
      UNION ALL SELECT 'Research', COUNT(*)::int FROM research_jobs WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Memories', COUNT(*)::int FROM user_memories WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
      UNION ALL SELECT 'Notes', COUNT(*)::int FROM user_notes WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso}
    `),
    db.execute(sql`
      SELECT 'Messages' AS label, COUNT(*)::int AS value FROM chat_messages WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Usage events', COUNT(*)::int FROM usage_events WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Meetings', COUNT(*)::int FROM calendar_events WHERE workspace_id = ${workspaceId} AND starts_at >= ${previousSinceIso} AND starts_at < ${sinceIso}
      UNION ALL SELECT 'Documents', COUNT(*)::int FROM documents WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Schedules', COUNT(*)::int FROM scheduled_tasks WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Emails', COUNT(*)::int FROM email_messages WHERE workspace_id = ${workspaceId} AND received_at >= ${previousSinceIso} AND received_at < ${sinceIso}
      UNION ALL SELECT 'Research', COUNT(*)::int FROM research_jobs WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Memories', COUNT(*)::int FROM user_memories WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
      UNION ALL SELECT 'Notes', COUNT(*)::int FROM user_notes WHERE workspace_id = ${workspaceId} AND created_at >= ${previousSinceIso} AND created_at < ${sinceIso}
    `),
    db.execute(sql`
      SELECT d::date AS day,
        COALESCE(m.messages, 0)::int AS messages,
        COALESCE(u.usage_events, 0)::int AS usage_events,
        COALESCE(c.meetings, 0)::int AS meetings,
        COALESCE(doc.documents, 0)::int AS documents,
        COALESCE(s.schedules, 0)::int AS schedules,
        COALESCE(e.emails, 0)::int AS emails,
        COALESCE(r.research, 0)::int AS research
      FROM generate_series(${sinceIso}::date, ${nowIso}::date, '1 day') d
      LEFT JOIN (SELECT date(created_at) AS day, COUNT(*)::int AS messages FROM chat_messages WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso} GROUP BY 1) m ON m.day = d::date
      LEFT JOIN (SELECT date(created_at) AS day, COUNT(*)::int AS usage_events FROM usage_events WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso} GROUP BY 1) u ON u.day = d::date
      LEFT JOIN (SELECT date(starts_at) AS day, COUNT(*)::int AS meetings FROM calendar_events WHERE workspace_id = ${workspaceId} AND starts_at >= ${sinceIso} GROUP BY 1) c ON c.day = d::date
      LEFT JOIN (SELECT date(created_at) AS day, COUNT(*)::int AS documents FROM documents WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso} GROUP BY 1) doc ON doc.day = d::date
      LEFT JOIN (SELECT date(created_at) AS day, COUNT(*)::int AS schedules FROM scheduled_tasks WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso} GROUP BY 1) s ON s.day = d::date
      LEFT JOIN (SELECT date(received_at) AS day, COUNT(*)::int AS emails FROM email_messages WHERE workspace_id = ${workspaceId} AND received_at >= ${sinceIso} GROUP BY 1) e ON e.day = d::date
      LEFT JOIN (SELECT date(created_at) AS day, COUNT(*)::int AS research FROM research_jobs WHERE workspace_id = ${workspaceId} AND created_at >= ${sinceIso} GROUP BY 1) r ON r.day = d::date
      ORDER BY day ASC
    `),
    db
      .select({
        key: calendarEvents.source,
        value: sql<number>`count(*)::int`,
      })
      .from(calendarEvents)
      .where(and(eq(calendarEvents.workspaceId, workspaceId), gte(calendarEvents.startsAt, since)))
      .groupBy(calendarEvents.source),
    db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${scheduledTasks.status} = 'active')::int`,
        paused: sql<number>`count(*) filter (where ${scheduledTasks.status} = 'paused')::int`,
        draft: sql<number>`count(*) filter (where ${scheduledTasks.status} = 'draft')::int`,
      })
      .from(scheduledTasks)
      .where(eq(scheduledTasks.workspaceId, workspaceId)),
    db
      .select({
        key: taskRuns.status,
        value: sql<number>`count(*)::int`,
      })
      .from(taskRuns)
      .where(and(eq(taskRuns.workspaceId, workspaceId), gte(taskRuns.createdAt, since)))
      .groupBy(taskRuns.status),
    db.execute(sql`
      SELECT
        (SELECT COUNT(*)::int FROM documents WHERE workspace_id = ${workspaceId}) AS documents,
        (SELECT COUNT(*)::int FROM documents WHERE workspace_id = ${workspaceId} AND archived = false) AS active_documents,
        (SELECT COUNT(*)::int FROM documents WHERE workspace_id = ${workspaceId} AND archived = true) AS archived_documents,
        (SELECT COUNT(*)::int FROM user_memories WHERE workspace_id = ${workspaceId} AND enabled = true) AS memories,
        (SELECT COUNT(*)::int FROM user_notes WHERE workspace_id = ${workspaceId} AND archived = false) AS notes,
        (SELECT COUNT(*)::int FROM workspace_skills WHERE workspace_id = ${workspaceId} AND enabled = true) AS skills
    `),
    db
      .select({
        status: emailMessages.status,
        total: sql<number>`count(*)::int`,
        urgent: sql<number>`count(*) filter (where ${emailMessages.urgency} = 'urgent')::int`,
      })
      .from(emailMessages)
      .where(and(eq(emailMessages.workspaceId, workspaceId), gte(emailMessages.receivedAt, since)))
      .groupBy(emailMessages.status),
    db
      .select({
        status: researchJobs.status,
        total: sql<number>`count(*)::int`,
      })
      .from(researchJobs)
      .where(and(eq(researchJobs.workspaceId, workspaceId), gte(researchJobs.createdAt, since)))
      .groupBy(researchJobs.status),
  ]);

  const current = new Map(rowsFromExecute<{ label: string; value: number }>(moduleRows).map((row) => [row.label, Number(row.value)]));
  const previous = new Map(rowsFromExecute<{ label: string; value: number }>(previousRows).map((row) => [row.label, Number(row.value)]));
  const value = (label: string) => current.get(label) ?? 0;
  const prev = (label: string) => previous.get(label) ?? 0;
  const moduleLabels = ['Messages', 'Usage events', 'Meetings', 'Documents', 'Schedules', 'Emails', 'Research', 'Memories', 'Notes'];
  const modules = moduleLabels.map((label) => ({
    key: label.toLowerCase().replaceAll(' ', '_'),
    label,
    value: value(label),
    previous: prev(label),
    changePct: pctChange(value(label), prev(label)),
  }));

  const activitySeries = rowsFromExecute<{
    day: string | Date;
    messages: number;
    usage_events: number;
    meetings: number;
    documents: number;
    schedules: number;
    emails: number;
    research: number;
  }>(activityRows).map((row) => ({
    date: String(row.day).slice(0, 10),
    messages: Number(row.messages ?? 0),
    usageEvents: Number(row.usage_events ?? 0),
    meetings: Number(row.meetings ?? 0),
    documents: Number(row.documents ?? 0),
    schedules: Number(row.schedules ?? 0),
    emails: Number(row.emails ?? 0),
    research: Number(row.research ?? 0),
  }));

  const totalMeetings = value('Meetings');
  const upcomingMeetings = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(calendarEvents)
    .where(and(eq(calendarEvents.workspaceId, workspaceId), gte(calendarEvents.startsAt, now)));
  const emailStatusRows = emailRows.map((row) => ({
    key: row.status,
    label: row.status,
    value: Number(row.total ?? 0),
  }));
  const researchStatusRows = researchRows.map((row) => ({
    key: row.status,
    label: row.status,
    value: Number(row.total ?? 0),
  }));
  const content = rowsFromExecute<{
    documents?: number;
    active_documents?: number;
    archived_documents?: number;
    memories?: number;
    notes?: number;
    skills?: number;
  }>(contentRows)[0] ?? {
    documents: 0,
    active_documents: 0,
    archived_documents: 0,
    memories: 0,
    notes: 0,
    skills: 0,
  };

  return {
    scorecard: {
      moduleActivity: metric(modules.reduce((sum, row) => sum + row.value, 0), modules.reduce((sum, row) => sum + row.previous, 0)),
      meetings: metric(value('Meetings'), prev('Meetings')),
      schedules: metric(value('Schedules'), prev('Schedules')),
      documents: metric(value('Documents'), prev('Documents')),
      emails: metric(value('Emails'), prev('Emails')),
      researchJobs: metric(value('Research'), prev('Research')),
      memories: metric(value('Memories'), prev('Memories')),
      notes: metric(value('Notes'), prev('Notes')),
    },
    modules,
    activitySeries,
    meetings: {
      total: totalMeetings,
      upcoming: Number(upcomingMeetings[0]?.total ?? 0),
      past: Math.max(0, totalMeetings - Number(upcomingMeetings[0]?.total ?? 0)),
      bySource: meetingSources.map((row) => ({
        key: row.key,
        label: normalizeLabel(row.key, 'local'),
        value: Number(row.value ?? 0),
      })),
    },
    schedules: {
      total: Number(scheduleRows[0]?.total ?? 0),
      active: Number(scheduleRows[0]?.active ?? 0),
      paused: Number(scheduleRows[0]?.paused ?? 0),
      draft: Number(scheduleRows[0]?.draft ?? 0),
      runs: scheduleRunRows.map((row) => ({
        key: row.key,
        label: row.key,
        value: Number(row.value ?? 0),
      })),
    },
    content: {
      documents: Number(content.documents ?? 0),
      activeDocuments: Number(content.active_documents ?? 0),
      archivedDocuments: Number(content.archived_documents ?? 0),
      memories: Number(content.memories ?? 0),
      notes: Number(content.notes ?? 0),
      skills: Number(content.skills ?? 0),
    },
    email: {
      total: emailStatusRows.reduce((sum, row) => sum + row.value, 0),
      inbox: emailStatusRows.find((row) => row.key === 'inbox')?.value ?? 0,
      draft: emailStatusRows.find((row) => row.key === 'draft')?.value ?? 0,
      sent: emailStatusRows.find((row) => row.key === 'sent')?.value ?? 0,
      urgent: emailRows.reduce((sum, row) => sum + Number(row.urgent ?? 0), 0),
      byStatus: emailStatusRows,
    },
    research: {
      total: researchStatusRows.reduce((sum, row) => sum + row.value, 0),
      completed: researchStatusRows.find((row) => row.key === 'completed')?.value ?? 0,
      running: researchStatusRows.find((row) => row.key === 'running')?.value ?? 0,
      failed: researchStatusRows.find((row) => row.key === 'failed')?.value ?? 0,
      byStatus: researchStatusRows,
    },
  };
}

async function loadCoreTelemetry(hours: number): Promise<AnalyticsOverview['core']> {
  if (!coreProxyEnabled()) return null;

  const token = resolveCoreProxyToken();
  const url = new URL('/api/ops/telemetry/overview', resolveCoreUrl().replace(/\/$/, ''));
  url.searchParams.set('hours', String(hours));

  try {
    const response = await fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-internal-key': token,
      },
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const payload = await response.json() as {
      generatedAt: string;
      health: {
        healthy: boolean;
        checks: Array<{ id: string; status: 'ok' | 'warn' | 'fail'; detail: string }>;
      };
      channels: {
        connected: number;
        configured: number;
        degraded: number;
      };
      metrics: {
        turns: {
          total: number;
          avgLatencyMs: number;
          buckets: Record<string, number>;
        };
        providers: {
          successes: number;
          fallbacks: number;
          cacheHits: number;
          cacheMisses: number;
        };
        traces: {
          activeSpans: number;
        };
      };
      sessions: {
        summary: {
          uniqueSessions: number;
          turns: number;
          avgLatencyMs: number;
          byPlatform: Record<string, number>;
          byProvider: Record<string, number>;
        };
      };
      subagents: {
        started: number;
        completed: number;
        failed: number;
        cancelled: number;
      };
    };

    return {
      generatedAt: payload.generatedAt,
      healthy: payload.health.healthy,
      checks: payload.health.checks,
      channels: payload.channels,
      turns: payload.metrics.turns,
      providers: payload.metrics.providers,
      sessions: payload.sessions.summary,
      subagents: payload.subagents,
      activeSpans: payload.metrics.traces.activeSpans,
    };
  } catch {
    return null;
  }
}

export async function buildAnalyticsOverview(workspaceId: string, rangeDays = 30): Promise<AnalyticsOverview> {
  const days = Math.min(Math.max(1, Math.floor(rangeDays)), 90);
  const since = startOfDay(days);
  const dayBucket = sql<string>`to_char(date_trunc('day', ${usageEvents.createdAt}), 'YYYY-MM-DD')`;
  const usageTokens = sql<number>`coalesce(sum(${usageEvents.inputTokens} + ${usageEvents.outputTokens}), 0)::int`;
  const usageEventsCount = sql<number>`count(*)::int`;

  const [usageSeriesRows, modelRows, providerRows, sessionRows, messageRows, assistantSessionRows, recentSessions] =
    await Promise.all([
      db
        .select({
          date: dayBucket,
          messages: usageEventsCount,
          tokens: usageTokens,
        })
        .from(usageEvents)
        .where(and(eq(usageEvents.workspaceId, workspaceId), gte(usageEvents.createdAt, since)))
        .groupBy(dayBucket)
        .orderBy(dayBucket),

      db
        .select({
          model: usageEvents.model,
          provider: usageEvents.provider,
          events: usageEventsCount,
          tokens: usageTokens,
        })
        .from(usageEvents)
        .where(and(eq(usageEvents.workspaceId, workspaceId), gte(usageEvents.createdAt, since)))
        .groupBy(usageEvents.model, usageEvents.provider)
        .orderBy(desc(usageTokens)),

      db
        .select({
          provider: usageEvents.provider,
          events: usageEventsCount,
          tokens: usageTokens,
        })
        .from(usageEvents)
        .where(and(eq(usageEvents.workspaceId, workspaceId), gte(usageEvents.createdAt, since)))
        .groupBy(usageEvents.provider)
        .orderBy(desc(usageTokens)),

      db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          lastMessageAt: chatSessions.lastMessageAt,
          createdAt: chatSessions.createdAt,
        })
        .from(chatSessions)
        .where(
          and(
            eq(chatSessions.workspaceId, workspaceId),
            eq(chatSessions.archived, false),
            or(gte(chatSessions.createdAt, since), gte(chatSessions.lastMessageAt, since)),
          ),
        ),

      db
        .select({
          total: sql<number>`count(*)::int`,
        })
        .from(chatMessages)
        .where(and(eq(chatMessages.workspaceId, workspaceId), gte(chatMessages.createdAt, since))),

      db
        .select({
          total: sql<number>`count(distinct ${chatMessages.sessionId})::int`,
        })
        .from(chatMessages)
        .where(and(eq(chatMessages.workspaceId, workspaceId), eq(chatMessages.role, 'assistant'), gte(chatMessages.createdAt, since))),

      db
        .select({
          id: chatSessions.id,
          title: chatSessions.title,
          lastMessageAt: chatSessions.lastMessageAt,
          turns: sql<number>`count(${chatMessages.id})::int`,
          assistantTurns: sql<number>`count(*) filter (where ${chatMessages.role} = 'assistant')::int`,
        })
        .from(chatSessions)
        .leftJoin(chatMessages, eq(chatMessages.sessionId, chatSessions.id))
        .where(
          and(
            eq(chatSessions.workspaceId, workspaceId),
            eq(chatSessions.archived, false),
            or(gte(chatSessions.createdAt, since), gte(chatSessions.lastMessageAt, since)),
          ),
        )
        .groupBy(chatSessions.id)
        .orderBy(desc(chatSessions.lastMessageAt))
        .limit(8),
    ]);

  const usageSeries = usageSeriesRows.map((row) => ({
    date: row.date,
    messages: Number(row.messages ?? 0),
    tokens: Number(row.tokens ?? 0),
    estimatedCostGbp: estimateCostGbp(Number(row.tokens ?? 0)),
  }));

  const totalTokens = usageSeries.reduce((sum, row) => sum + row.tokens, 0);
  const totalCost = estimateCostGbp(totalTokens);
  const totalMessages = Number(messageRows[0]?.total ?? 0);
  const totalSessions = sessionRows.length;
  const activeSessions = sessionRows.filter((row) => classifySessionStatus(row.lastMessageAt?.toISOString() ?? null) === 'active').length;
  const idleSessions = sessionRows.filter((row) => classifySessionStatus(row.lastMessageAt?.toISOString() ?? null) === 'idle').length;
  const staleSessions = sessionRows.filter((row) => classifySessionStatus(row.lastMessageAt?.toISOString() ?? null) === 'stale').length;
  const completionRate = totalSessions > 0
    ? Math.round((Number(assistantSessionRows[0]?.total ?? 0) / totalSessions) * 100)
    : 0;
  const avgTurnsPerSession = totalSessions > 0 ? Number((totalMessages / totalSessions).toFixed(1)) : 0;

  const modelBreakdown = modelRows
    .map((row, index) => ({
      key: normalizeLabel(row.model, 'Unknown model'),
      provider: normalizeLabel(row.provider, 'Unknown provider'),
      tokens: Number(row.tokens ?? 0),
      events: Number(row.events ?? 0),
      estimatedCostGbp: estimateCostGbp(Number(row.tokens ?? 0)),
      share: totalTokens > 0 ? Math.round((Number(row.tokens ?? 0) / totalTokens) * 100) : 0,
      _rank: index,
    }))
    .sort((a, b) => b.tokens - a.tokens)
    .map(({ _rank, ...row }) => row);

  const providerBreakdown = providerRows
    .map((row) => ({
      key: normalizeLabel(row.provider, 'Unknown provider'),
      provider: normalizeLabel(row.provider, 'Unknown provider'),
      tokens: Number(row.tokens ?? 0),
      events: Number(row.events ?? 0),
      estimatedCostGbp: estimateCostGbp(Number(row.tokens ?? 0)),
      share: totalTokens > 0 ? Math.round((Number(row.tokens ?? 0) / totalTokens) * 100) : 0,
    }))
    .sort((a, b) => b.tokens - a.tokens);

  const topModel = modelBreakdown[0]?.key ?? null;
  const topProvider = providerBreakdown[0]?.provider ?? null;

  const sessions = recentSessions.map((row) => ({
    id: row.id,
    title: row.title,
    lastMessageAt: row.lastMessageAt ? row.lastMessageAt.toISOString() : null,
    status: classifySessionStatus(row.lastMessageAt ? row.lastMessageAt.toISOString() : null),
    turns: Number(row.turns ?? 0),
    assistantTurns: Number(row.assistantTurns ?? 0),
  }));

  return {
    generatedAt: new Date().toISOString(),
    rangeDays: days,
    workspace: {
      totalSessions,
      activeSessions,
      idleSessions,
      staleSessions,
      totalMessages,
      totalTokens,
      estimatedCostGbp: totalCost,
      avgTurnsPerSession,
      completionRate,
      topModel,
      topProvider,
      usageSeries,
      modelBreakdown,
      providerBreakdown,
      sessions,
    },
    business: await loadBusinessOverview(workspaceId, days, since),
    aiva: await loadAivaOverview(workspaceId, days),
    core: await loadCoreTelemetry(Math.min(days * 24, 168)),
  };
}
