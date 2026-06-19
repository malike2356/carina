import { afterEach, describe, expect, it } from 'vitest';
import { classifyError, formatClassifiedError } from './error-classifier.js';
import {
  formatLegacyTokenChunk,
  formatStreamDone,
  formatStreamSseEvent,
  parseStreamPayload,
  streamEvent,
} from './stream-events.js';
import {
  _resetProviderObservationsForTests,
  listProviderObservations,
  recordProviderFallback,
  recordProviderSuccess,
  summarizeProviderObservations,
} from './provider-observation.js';
import {
  _resetSubagentMetricsForTests,
  recordSubagentMetric,
  summarizeSubagentMetrics,
} from './subagent-metrics.js';
import {
  cancelStreamSession,
  getStreamAbortSignal,
  registerStreamSession,
  _resetStreamSessionsForTests,
} from './stream-session.js';
import { _resetActiveSpansForTests, endTraceSpan, startTraceSpan } from './trace.js';
import { buildTelemetryHealthSnapshot } from '../ops/observability/health-snapshot.js';

describe('error-classifier', () => {
  it('classifies rate limits as retryable', () => {
    const err = classifyError(new Error('HTTP 429 rate limit exceeded'));
    expect(err.class).toBe('rate_limit');
    expect(err.retryable).toBe(true);
    expect(formatClassifiedError(err)).toContain('[rate_limit]');
  });

  it('classifies budget errors as non-retryable', () => {
    const err = classifyError(new Error('Monthly budget exhausted'));
    expect(err.class).toBe('budget');
    expect(err.retryable).toBe(false);
  });
});

describe('stream-events', () => {
  it('formats structured SSE events', () => {
    const frame = formatStreamSseEvent(streamEvent('status', { content: 'thinking' }));
    expect(frame).toContain('event: status');
    expect(frame).toContain('thinking');
  });

  it('keeps legacy token chunks compatible', () => {
    const frame = formatLegacyTokenChunk('hello');
    expect(frame).toBe('data: "hello"\n\n');
    expect(parseStreamPayload('hello')).toBe('hello');
    expect(formatStreamDone()).toBe('data: [DONE]\n\n');
  });
});

describe('provider-observation', () => {
  afterEach(() => _resetProviderObservationsForTests());

  it('records fallback chain events', () => {
    recordProviderSuccess('anthropic');
    recordProviderFallback('anthropic', 'openai', new Error('timeout'));
    const summary = summarizeProviderObservations();
    expect(summary.successes).toBe(1);
    expect(summary.fallbacks).toBe(1);
    expect(listProviderObservations().some((o) => o.kind === 'fallback')).toBe(true);
  });
});

describe('subagent-metrics', () => {
  afterEach(() => _resetSubagentMetricsForTests());

  it('tracks subagent lifecycle', () => {
    recordSubagentMetric({
      sessionId: 's1',
      agentType: 'research',
      status: 'started',
    });
    recordSubagentMetric({
      sessionId: 's1',
      agentType: 'research',
      status: 'completed',
      latencyMs: 1200,
    });
    const summary = summarizeSubagentMetrics();
    expect(summary.started).toBe(1);
    expect(summary.completed).toBe(1);
  });
});

describe('stream-session', () => {
  afterEach(() => _resetStreamSessionsForTests());

  it('cancels in-flight stream sessions', () => {
    const controller = registerStreamSession('sess', 'turn-1');
    expect(getStreamAbortSignal('sess', 'turn-1')).toBe(controller.signal);
    expect(cancelStreamSession('sess', 'turn-1')).toBe(true);
    expect(controller.signal.aborted).toBe(true);
  });
});

describe('trace', () => {
  afterEach(() => _resetActiveSpansForTests());

  it('records span duration on end', async () => {
    const span = startTraceSpan('agent.turn', { sessionId: 's1' });
    const ended = await endTraceSpan(span.spanId, 'ok', { tools: 2 });
    expect(ended?.durationMs).toBeGreaterThanOrEqual(0);
    expect(ended?.status).toBe('ok');
  });
});

describe('telemetry health snapshot', () => {
  it('returns structured health checks', async () => {
    const snapshot = await buildTelemetryHealthSnapshot();
    expect(snapshot.checks.length).toBeGreaterThan(4);
    expect(typeof snapshot.healthy).toBe('boolean');
    expect(snapshot.channels).toHaveProperty('connected');
    expect(snapshot.otel).toHaveProperty('enabled');
    expect(snapshot.promptCache).toHaveProperty('stats');
    expect(snapshot.sessions).toHaveProperty('turns');
    expect(snapshot.subagents).toHaveProperty('completed');
  });
});
