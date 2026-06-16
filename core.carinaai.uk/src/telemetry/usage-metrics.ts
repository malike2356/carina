import { countTurnBuckets, readTurnLogs, type TurnBucket } from './turn-log.js';
import { listSubagentMetrics, summarizeSubagentMetrics } from './subagent-metrics.js';
import {
  listProviderObservations,
  summarizeProviderObservations,
} from './provider-observation.js';
import { getPromptCacheStats } from '../brain/prompt-cache.js';
import { listActiveSpans } from './trace.js';

export type UsageMetricsSnapshot = {
  generatedAt: string;
  turns: {
    total: number;
    buckets: Record<TurnBucket, number>;
    avgLatencyMs: number;
  };
  providers: ReturnType<typeof summarizeProviderObservations> & {
    promptCache: ReturnType<typeof getPromptCacheStats>;
    recent: ReturnType<typeof listProviderObservations>;
  };
  subagents: ReturnType<typeof summarizeSubagentMetrics> & {
    recent: ReturnType<typeof listSubagentMetrics>;
  };
  traces: {
    activeSpans: number;
  };
};

export async function buildUsageMetricsSnapshot(sinceHours = 24): Promise<UsageMetricsSnapshot> {
  const since = new Date(Date.now() - sinceHours * 3_600_000);
  const turns = await readTurnLogs({ since, limit: 500 });
  const buckets = countTurnBuckets(turns);
  const totalLatency = turns.reduce((sum, t) => sum + t.latencyMs, 0);

  return {
    generatedAt: new Date().toISOString(),
    turns: {
      total: turns.length,
      buckets,
      avgLatencyMs: turns.length > 0 ? Math.round(totalLatency / turns.length) : 0,
    },
    providers: {
      ...summarizeProviderObservations(),
      promptCache: getPromptCacheStats(),
      recent: listProviderObservations(20),
    },
    subagents: {
      ...summarizeSubagentMetrics(),
      recent: listSubagentMetrics(20),
    },
    traces: {
      activeSpans: listActiveSpans().length,
    },
  };
}
