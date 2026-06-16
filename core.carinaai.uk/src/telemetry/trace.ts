import fs from 'fs/promises';
import path from 'path';
import { globalCarinaHome } from '../config/paths.js';

export type TraceSpanStatus = 'ok' | 'error' | 'cancelled';

export type TraceSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTs: string;
  endTs?: string;
  durationMs?: number;
  status: TraceSpanStatus;
  attributes?: Record<string, string | number | boolean>;
};

const activeSpans = new Map<string, TraceSpan>();
const MAX_ACTIVE = 500;

function traceLogPath(): string {
  const home = process.env.CARINA_HOME ?? globalCarinaHome();
  return path.join(home, 'data', 'logs', 'traces.jsonl');
}

export function traceEnabled(): boolean {
  return process.env.CARINA_TRACE !== 'false';
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startTraceSpan(
  name: string,
  attrs?: Record<string, string | number | boolean>,
  parentSpanId?: string,
): TraceSpan {
  const span: TraceSpan = {
    traceId: parentSpanId
      ? (activeSpans.get(parentSpanId)?.traceId ?? newId('tr'))
      : newId('tr'),
    spanId: newId('sp'),
    parentSpanId,
    name,
    startTs: new Date().toISOString(),
    status: 'ok',
    attributes: attrs,
  };
  if (activeSpans.size >= MAX_ACTIVE) {
    const first = activeSpans.keys().next().value;
    if (first) activeSpans.delete(first);
  }
  activeSpans.set(span.spanId, span);
  return span;
}

export async function endTraceSpan(
  spanId: string,
  status: TraceSpanStatus = 'ok',
  attrs?: Record<string, string | number | boolean>,
): Promise<TraceSpan | null> {
  const span = activeSpans.get(spanId);
  if (!span) return null;
  span.endTs = new Date().toISOString();
  span.durationMs = new Date(span.endTs).getTime() - new Date(span.startTs).getTime();
  span.status = status;
  if (attrs) span.attributes = { ...span.attributes, ...attrs };
  activeSpans.delete(spanId);
  if (traceEnabled()) {
    try {
      const file = traceLogPath();
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.appendFile(file, `${JSON.stringify(span)}\n`, 'utf8');
    } catch {
      // non-blocking
    }
  }
  return span;
}

export function listActiveSpans(): TraceSpan[] {
  return [...activeSpans.values()];
}

export async function readTraceTail(limit = 50): Promise<TraceSpan[]> {
  const file = traceLogPath();
  let raw = '';
  try {
    raw = await fs.readFile(file, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  const spans: TraceSpan[] = [];
  for (const line of lines.slice(-limit)) {
    try {
      spans.push(JSON.parse(line) as TraceSpan);
    } catch {
      // skip
    }
  }
  return spans.reverse();
}

/** Reset active spans (tests only). */
export function _resetActiveSpansForTests(): void {
  activeSpans.clear();
}
