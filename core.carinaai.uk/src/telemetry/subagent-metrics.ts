export type SubagentMetric = {
  ts: string;
  sessionId: string;
  agentType: string;
  status: 'started' | 'completed' | 'failed' | 'cancelled';
  latencyMs?: number;
  errorClass?: string;
};

const metrics: SubagentMetric[] = [];
const MAX = 200;

export function recordSubagentMetric(entry: Omit<SubagentMetric, 'ts'>): SubagentMetric {
  const row: SubagentMetric = { ...entry, ts: new Date().toISOString() };
  metrics.push(row);
  if (metrics.length > MAX) metrics.splice(0, metrics.length - MAX);
  return row;
}

export function listSubagentMetrics(limit = 50): SubagentMetric[] {
  return [...metrics].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export function summarizeSubagentMetrics(): {
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
} {
  const out = { started: 0, completed: 0, failed: 0, cancelled: 0 };
  for (const m of metrics) {
    out[m.status] += 1;
  }
  return out;
}

export function _resetSubagentMetricsForTests(): void {
  metrics.length = 0;
}
