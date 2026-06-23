export type AnalyticsSeriesPoint = {
  date: string;
  messages: number;
  tokens: number;
  estimatedCostGbp: number;
};

export type AnalyticsBreakdownRow = {
  key: string;
  provider: string;
  tokens: number;
  events: number;
  estimatedCostGbp: number;
  share: number;
};

export type AnalyticsSessionRow = {
  id: string;
  title: string;
  lastMessageAt: string | null;
  status: 'active' | 'idle' | 'stale';
  turns: number;
  assistantTurns: number;
};

export type AnalyticsOverview = {
  generatedAt: string;
  rangeDays: number;
  workspace: {
    totalSessions: number;
    activeSessions: number;
    idleSessions: number;
    staleSessions: number;
    totalMessages: number;
    totalTokens: number;
    estimatedCostGbp: number;
    avgTurnsPerSession: number;
    completionRate: number;
    topModel: string | null;
    topProvider: string | null;
    usageSeries: AnalyticsSeriesPoint[];
    modelBreakdown: AnalyticsBreakdownRow[];
    providerBreakdown: AnalyticsBreakdownRow[];
    sessions: AnalyticsSessionRow[];
  };
  core: {
    generatedAt: string;
    healthy: boolean;
    checks: Array<{ id: string; status: 'ok' | 'warn' | 'fail'; detail: string }>;
    channels: {
      connected: number;
      configured: number;
      degraded: number;
    };
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
    sessions: {
      uniqueSessions: number;
      turns: number;
      avgLatencyMs: number;
      byPlatform: Record<string, number>;
      byProvider: Record<string, number>;
    };
    subagents: {
      started: number;
      completed: number;
      failed: number;
      cancelled: number;
    };
    activeSpans: number;
  } | null;
};

export function formatGbp(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 2,
  }).format(value);
}
