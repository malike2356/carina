import 'server-only';

import { and, desc, eq, gte, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, chatSessions, usageEvents } from '@/db/schema';
import { coreProxyEnabled, resolveCoreProxyToken, resolveCoreUrl } from '@/lib/core-proxy';
import type {
  AnalyticsBreakdownRow,
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
    core: await loadCoreTelemetry(Math.min(days * 24, 168)),
  };
}
