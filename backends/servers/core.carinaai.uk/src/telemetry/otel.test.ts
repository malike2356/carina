import { afterEach, describe, expect, it } from 'vitest';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  _resetOtelForTests,
  getOtelStatus,
  initOtel,
  otelEnabled,
  shutdownOtel,
} from './otel.js';
import { _resetActiveSpansForTests, endTraceSpan, startTraceSpan } from './trace.js';

const ENV_KEYS = [
  'OTEL_ENABLED',
  'OTEL_EXPORTER_OTLP_ENDPOINT',
  'OTEL_EXPORTER_OTLP_TRACES_ENDPOINT',
  'OTEL_TRACES_EXPORTER',
] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  return saved;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

describe('otel', () => {
  afterEach(async () => {
    await shutdownOtel();
    _resetOtelForTests();
    _resetActiveSpansForTests();
  });

  it('is disabled when OTEL_ENABLED=false', () => {
    const saved = saveEnv();
    process.env.OTEL_ENABLED = 'false';
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_TRACES_EXPORTER;
    expect(otelEnabled()).toBe(false);
    restoreEnv(saved);
  });

  it('is enabled when OTEL_EXPORTER_OTLP_ENDPOINT is set', () => {
    const saved = saveEnv();
    delete process.env.OTEL_ENABLED;
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:4318';
    expect(otelEnabled()).toBe(true);
    restoreEnv(saved);
  });

  it('mirrors Carina trace spans into OTel', async () => {
    const exporter = new InMemorySpanExporter();
    const ok = await initOtel({ processors: [new SimpleSpanProcessor(exporter)] });
    expect(ok).toBe(true);
    expect(getOtelStatus().initialized).toBe(true);

    const span = startTraceSpan('agent.turn', { sessionId: 'sess-1', channel: 'cli' });
    await endTraceSpan(span.spanId, 'ok', { tools: 2 });

    const finished = exporter.getFinishedSpans();
    expect(finished.length).toBe(1);
    expect(finished[0]?.name).toBe('agent.turn');
    expect(finished[0]?.attributes?.['carina.span_id']).toBe(span.spanId);
    expect(finished[0]?.attributes?.channel).toBe('cli');
    expect(finished[0]?.attributes?.tools).toBe(2);

    await shutdownOtel();
  });
});
