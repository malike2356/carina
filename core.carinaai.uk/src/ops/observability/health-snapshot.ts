import { getChannelStatusReports } from '../../gateway/channels/channel-status.js';
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
  };
}
