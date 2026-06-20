import { buildSessionOverview, type AgentSessionOverview } from '../ops/observability/session-overview.js';
import { countTurnBuckets, readTurnLogs } from './turn-log.js';
import {
  listSubagentMetrics,
  summarizeSubagentMetrics,
  type SubagentMetric,
} from './subagent-metrics.js';

export type SessionTelemetrySummary = {
  uniqueSessions: number;
  turns: number;
  buckets: ReturnType<typeof countTurnBuckets>;
  avgLatencyMs: number;
  byPlatform: Record<string, number>;
  byProvider: Record<string, number>;
};

export type SessionTelemetryBundle = {
  generatedAt: string;
  summary: SessionTelemetrySummary;
  sessions: AgentSessionOverview[];
  subagents: ReturnType<typeof summarizeSubagentMetrics>;
  recentSubagents: SubagentMetric[];
};

export async function summarizeSessionTelemetry(sinceHours = 24): Promise<SessionTelemetrySummary> {
  const since = new Date(Date.now() - sinceHours * 3_600_000);
  const turns = await readTurnLogs({ since, limit: 500 });
  const sessions = new Set(turns.map((t) => t.sessionId));
  const byPlatform: Record<string, number> = {};
  const byProvider: Record<string, number> = {};
  let latencyTotal = 0;

  for (const turn of turns) {
    byPlatform[turn.platform] = (byPlatform[turn.platform] ?? 0) + 1;
    byProvider[turn.provider] = (byProvider[turn.provider] ?? 0) + 1;
    latencyTotal += turn.latencyMs;
  }

  return {
    uniqueSessions: sessions.size,
    turns: turns.length,
    buckets: countTurnBuckets(turns),
    avgLatencyMs: turns.length > 0 ? Math.round(latencyTotal / turns.length) : 0,
    byPlatform,
    byProvider,
  };
}

export async function buildSessionTelemetryBundle(sinceHours = 24): Promise<SessionTelemetryBundle> {
  const [summary, sessions] = await Promise.all([
    summarizeSessionTelemetry(sinceHours),
    buildSessionOverview(),
  ]);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    sessions,
    subagents: summarizeSubagentMetrics(),
    recentSubagents: listSubagentMetrics(30),
  };
}
