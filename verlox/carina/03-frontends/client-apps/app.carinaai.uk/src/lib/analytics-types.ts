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

export type AnalyticsMetricTrend = {
  current: number;
  previous: number;
  changePct: number;
};

export type AnalyticsModuleMetric = {
  key: string;
  label: string;
  value: number;
  previous: number;
  changePct: number;
};

export type AnalyticsStatusRow = {
  key: string;
  label: string;
  value: number;
};

export type AnalyticsChannelRow = {
  channel: string;
  count: number;
  pct: number;
};

export type AnalyticsAivaWorkerRow = {
  workerId: string;
  workerName: string;
  messageCount: number;
  escalationCount: number;
  avgResponseSec: number;
};

export type AnalyticsHeatmapCell = {
  dayOfWeek: number;
  hour: number;
  count: number;
};

export type AnalyticsBusinessOverview = {
  scorecard: {
    moduleActivity: AnalyticsMetricTrend;
    meetings: AnalyticsMetricTrend;
    schedules: AnalyticsMetricTrend;
    documents: AnalyticsMetricTrend;
    emails: AnalyticsMetricTrend;
    researchJobs: AnalyticsMetricTrend;
    memories: AnalyticsMetricTrend;
    notes: AnalyticsMetricTrend;
  };
  modules: AnalyticsModuleMetric[];
  activitySeries: Array<{
    date: string;
    messages: number;
    usageEvents: number;
    meetings: number;
    documents: number;
    schedules: number;
    emails: number;
    research: number;
  }>;
  meetings: {
    total: number;
    upcoming: number;
    past: number;
    bySource: AnalyticsStatusRow[];
  };
  schedules: {
    total: number;
    active: number;
    paused: number;
    draft: number;
    runs: AnalyticsStatusRow[];
  };
  content: {
    documents: number;
    activeDocuments: number;
    archivedDocuments: number;
    memories: number;
    notes: number;
    skills: number;
  };
  email: {
    total: number;
    inbox: number;
    draft: number;
    sent: number;
    urgent: number;
    byStatus: AnalyticsStatusRow[];
  };
  research: {
    total: number;
    completed: number;
    running: number;
    failed: number;
    byStatus: AnalyticsStatusRow[];
  };
};

export type AnalyticsAivaOverview = {
  available: boolean;
  gated: boolean;
  summary: {
    totalConversations: number;
    messagesFromAiva: number;
    escalationRate: number;
    avgResponseSec: number;
  };
  volume: Array<{ date: string; count: number }>;
  channels: AnalyticsChannelRow[];
  escalations: Array<{ date: string; total: number; escalated: number; rate: number }>;
  heatmap: AnalyticsHeatmapCell[];
  workers: AnalyticsAivaWorkerRow[];
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
  business: AnalyticsBusinessOverview;
  aiva: AnalyticsAivaOverview;
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
