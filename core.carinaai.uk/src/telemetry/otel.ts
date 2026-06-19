import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { TraceSpan, TraceSpanStatus } from './trace.js';

export type OtelStatus = {
  enabled: boolean;
  initialized: boolean;
  serviceName: string;
  endpoint?: string;
  exporter?: string;
};

let initialized = false;
let shutdownHook: (() => Promise<void>) | null = null;
let otelApi: (typeof import('@opentelemetry/api')) | null = null;
const spanMap = new Map<string, import('@opentelemetry/api').Span>();

function tracesEndpoint(): string | undefined {
  const traces = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  if (traces) return traces;
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!base) return undefined;
  return base.endsWith('/v1/traces') ? base : `${base.replace(/\/$/, '')}/v1/traces`;
}

export function isOtelInitialized(): boolean {
  return initialized;
}

export function otelEnabled(): boolean {
  if (process.env.OTEL_ENABLED === 'false') return false;
  if (process.env.OTEL_ENABLED === 'true') return true;
  if (process.env.OTEL_TRACES_EXPORTER === 'none') return false;
  return Boolean(
    tracesEndpoint()
    || process.env.OTEL_TRACES_EXPORTER === 'otlp'
    || process.env.OTEL_TRACES_EXPORTER === 'console',
  );
}

export function getOtelStatus(): OtelStatus {
  const exporter = process.env.OTEL_TRACES_EXPORTER?.trim() || (tracesEndpoint() ? 'otlp' : undefined);
  return {
    enabled: otelEnabled(),
    initialized,
    serviceName: process.env.OTEL_SERVICE_NAME?.trim() || 'carina-core',
    endpoint: tracesEndpoint(),
    exporter,
  };
}

function normalizeAttributes(
  attrs?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  if (!attrs) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    out[key] = value;
  }
  return out;
}

export async function initOtel(options?: { processors?: SpanProcessor[] }): Promise<boolean> {
  if (initialized) return true;
  if (!otelEnabled() && !options?.processors?.length) return false;

  try {
    otelApi = await import('@opentelemetry/api');
  } catch {
    return false;
  }

  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');
  const { BatchSpanProcessor, SimpleSpanProcessor } = await import('@opentelemetry/sdk-trace-base');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } = await import('@opentelemetry/semantic-conventions');

  const serviceName = process.env.OTEL_SERVICE_NAME?.trim() || 'carina-core';
  const serviceVersion = process.env.CARINA_VERSION?.trim() || process.env.npm_package_version || '0.2.0';

  const processors: SpanProcessor[] = options?.processors ? [...options.processors] : [];

  if (!options?.processors?.length) {
    const exporterKind = process.env.OTEL_TRACES_EXPORTER?.trim() || 'otlp';
    if (exporterKind === 'console') {
      const { ConsoleSpanExporter } = await import('@opentelemetry/sdk-trace-base');
      processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
    } else {
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const endpoint = tracesEndpoint() ?? 'http://127.0.0.1:4318/v1/traces';
      processors.push(new BatchSpanProcessor(new OTLPTraceExporter({ url: endpoint })));
    }
  }

  const provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
    }),
    spanProcessors: processors,
  });

  provider.register();
  initialized = true;
  shutdownHook = async () => {
    await provider.shutdown();
    initialized = false;
    shutdownHook = null;
    spanMap.clear();
  };

  return true;
}

export function mirrorTraceSpanStart(carinaSpan: TraceSpan): void {
  if (!initialized || !otelApi) return;
  const { context, trace } = otelApi;
  const tracer = trace.getTracer('carina-core', process.env.CARINA_VERSION ?? '0.2.0');
  let ctx = context.active();
  if (carinaSpan.parentSpanId) {
    const parent = spanMap.get(carinaSpan.parentSpanId);
    if (parent) ctx = trace.setSpan(ctx, parent);
  }

  const otelSpan = tracer.startSpan(
    carinaSpan.name,
    {
      attributes: {
        'carina.trace_id': carinaSpan.traceId,
        'carina.span_id': carinaSpan.spanId,
        ...normalizeAttributes(carinaSpan.attributes),
      },
    },
    ctx,
  );
  spanMap.set(carinaSpan.spanId, otelSpan);
}

export function mirrorTraceSpanEnd(
  spanId: string,
  status: TraceSpanStatus,
  attrs?: Record<string, string | number | boolean>,
): void {
  if (!initialized || !otelApi) return;
  const otelSpan = spanMap.get(spanId);
  if (!otelSpan) return;

  if (attrs) otelSpan.setAttributes(normalizeAttributes(attrs));
  if (status === 'error') {
    otelSpan.setStatus({ code: otelApi.SpanStatusCode.ERROR });
  } else if (status === 'cancelled') {
    otelSpan.setStatus({ code: otelApi.SpanStatusCode.OK, message: 'cancelled' });
  } else {
    otelSpan.setStatus({ code: otelApi.SpanStatusCode.OK });
  }

  otelSpan.end();
  spanMap.delete(spanId);
}

export async function shutdownOtel(): Promise<void> {
  if (shutdownHook) await shutdownHook();
}

/** Tests only */
export function _resetOtelForTests(): void {
  spanMap.clear();
  initialized = false;
  shutdownHook = null;
  otelApi = null;
}

export function _otelSpanCountForTests(): number {
  return spanMap.size;
}
