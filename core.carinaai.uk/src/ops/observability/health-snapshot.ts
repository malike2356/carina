import { buildChannelHealthSnapshot } from './channel-health.js';
import { getChannelStatusReports } from '../../gateway/channels/channel-status.js';
import { getOtelStatus, otelEnabled } from '../../telemetry/otel.js';
import { buildPromptCacheObservability } from '../../telemetry/prompt-cache-observability.js';
import { summarizeSessionTelemetry } from '../../telemetry/session-telemetry.js';
import { summarizeSubagentMetrics } from '../../telemetry/subagent-metrics.js';
import { buildUsageMetricsSnapshot } from '../../telemetry/usage-metrics.js';
import { listActiveSpans, readTraceTail } from '../../telemetry/trace.js';
import { readTurnLogs, countTurnBuckets } from '../../telemetry/turn-log.js';
import { classifyError } from '../../telemetry/error-classifier.js';

export type TelemetryHealthCheck = {
  id: string;
  status: 'ok' | 'warn' | 'fail';
  detail: string;
};

export type TelemetryHealthSnapshot = {
  generatedAt: string;
  healthy: boolean;
  checks: TelemetryHealthCheck[];
  channels: {
    connected: number;
    configured: number;
    degraded: number;
  };
  turns24h: ReturnType<typeof countTurnBuckets>;
  otel: ReturnType<typeof getOtelStatus>;
  promptCache: ReturnType<typeof buildPromptCacheObservability>;
  sessions: Awaited<ReturnType<typeof summarizeSessionTelemetry>>;
  subagents: ReturnType<typeof summarizeSubagentMetrics>;
};

export async function buildTelemetryHealthSnapshot(): Promise<TelemetryHealthSnapshot> {
  const checks: TelemetryHealthCheck[] = [];
  const push = (id: string, status: TelemetryHealthCheck['status'], detail: string): void => {
    checks.push({ id, status, detail });
  };

  const channelReports = getChannelStatusReports();
  const connected = channelReports.filter((r) => r.state === 'connected').length;
  const configured = channelReports.filter((r) => r.state === 'configured' || r.state === 'connected').length;
  const degraded = channelReports.filter((r) => r.state === 'error' || r.state === 'partial').length;

  if (degraded > 0) {
    push('channels', 'warn', `${degraded} channel(s) degraded`);
  } else if (connected > 0) {
    push('channels', 'ok', `${connected} channel(s) connected`);
  } else {
    push('channels', 'ok', 'no live channels (web/cli only)');
  }

  const since = new Date(Date.now() - 24 * 3_600_000);
  const turns = await readTurnLogs({ since, limit: 200 });
  const buckets = countTurnBuckets(turns);
  const toolErrors = buckets.tool_error + buckets.injection;
  if (toolErrors > 10) {
    push('turn-errors', 'warn', `${toolErrors} error/injection turns in 24h`);
  } else {
    push('turn-errors', 'ok', `${turns.length} turns in 24h`);
  }

  const metrics = await buildUsageMetricsSnapshot(24);
  if (metrics.providers.fallbacks > 20) {
    push('provider-fallback', 'warn', `${metrics.providers.fallbacks} provider fallbacks in window`);
  } else {
    push('provider-fallback', 'ok', `${metrics.providers.fallbacks} fallbacks`);
  }

  const traces = await readTraceTail(5);
  push('tracing', traces.length > 0 || metrics.traces.activeSpans > 0 ? 'ok' : 'warn', `active spans=${metrics.traces.activeSpans}`);

  const otel = getOtelStatus();
  if (otel.enabled && otel.initialized) {
    push('otel', 'ok', `${otel.exporter ?? 'otlp'} export (${otel.serviceName})`);
  } else if (otelEnabled()) {
    push('otel', 'warn', 'OTEL configured but exporter not initialized');
  } else {
    push('otel', 'ok', 'OTEL export disabled');
  }

  const promptCache = buildPromptCacheObservability();
  if (promptCache.enabled) {
    const rate = promptCache.hitRatePercent ?? 0;
    push('prompt-cache', rate >= 40 || promptCache.stats.hits + promptCache.stats.misses < 5
      ? 'ok'
      : 'warn',
    `hits=${promptCache.stats.hits} misses=${promptCache.stats.misses} rate=${rate ?? 0}%`);
  } else {
    push('prompt-cache', 'ok', 'prompt cache disabled (set CARINA_PROMPT_CACHE=true)');
  }

  const sessions = await summarizeSessionTelemetry(24);
  push('sessions', sessions.turns > 0 ? 'ok' : 'warn', `${sessions.uniqueSessions} sessions, ${sessions.turns} turns in 24h`);

  const subagents = summarizeSubagentMetrics();
  if (subagents.failed > 5) {
    push('subagents', 'warn', `${subagents.failed} failed subagent runs in buffer`);
  } else {
    push('subagents', 'ok', `${subagents.completed} completed, ${subagents.failed} failed`);
  }

  try {
    classifyError(new Error('rate limit exceeded'));
    push('error-classifier', 'ok', 'error classifier loaded');
  } catch (err) {
    push('error-classifier', 'fail', err instanceof Error ? err.message : String(err));
  }

  const healthy = !checks.some((c) => c.status === 'fail');

  return {
    generatedAt: new Date().toISOString(),
    healthy,
    checks,
    channels: { connected, configured, degraded },
    turns24h: buckets,
    otel,
    promptCache,
    sessions,
    subagents,
  };
}

export async function buildTelemetryOverview(hours = 24): Promise<{
  health: TelemetryHealthSnapshot;
  metrics: Awaited<ReturnType<typeof buildUsageMetricsSnapshot>>;
  channels: ReturnType<typeof buildChannelHealthSnapshot>;
  sessions: Awaited<ReturnType<typeof import('../../telemetry/session-telemetry.js').buildSessionTelemetryBundle>>;
}> {
  const { buildSessionTelemetryBundle } = await import('../../telemetry/session-telemetry.js');
  const [health, metrics, sessions] = await Promise.all([
    buildTelemetryHealthSnapshot(),
    buildUsageMetricsSnapshot(hours),
    buildSessionTelemetryBundle(hours),
  ]);

  return {
    health,
    metrics,
    channels: buildChannelHealthSnapshot(),
    sessions,
  };
}
