import { randomUUID } from 'node:crypto';

export type ErrorLogContext = {
  route?: string;
  method?: string;
  userId?: string | null;
  sessionId?: string | null;
  statusCode?: number;
  requestBody?: unknown;
  environment?: string;
  frameworkVersion?: string;
  boundary?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type PrivateErrorEntry = {
  errorReference: string;
  timestamp: string;
  message: string;
  name: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  userId: string | null;
  sessionId: string | null;
  statusCode: number;
  requestBody: unknown;
  environment: string;
  frameworkVersion: string | null;
  boundary: string | null;
  meta: Record<string, string | number | boolean | null>;
};

export type ErrorSearchFilters = {
  from?: string;
  to?: string;
  userId?: string;
  route?: string;
  statusCode?: number;
  errorReference?: string;
  limit?: number;
};

export type SpikeAlert = {
  triggered: boolean;
  count: number;
  windowMs: number;
  threshold: number;
  message: string;
};

const REDACT_KEYS = new Set([
  'password',
  'passwd',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'authorization',
  'card_number',
  'credit_card',
  'cvv',
  'cvc',
  'ssn',
]);

const store: PrivateErrorEntry[] = [];
const listeners: Array<(entry: PrivateErrorEntry, spike: SpikeAlert) => void> = [];

const SPIKE_WINDOW_MS = 5 * 60 * 1000;
const SPIKE_THRESHOLD = 10;

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const key = k.toLowerCase().replace(/[\s-]+/g, '_');
      if (REDACT_KEYS.has(key) || key.includes('password') || key.includes('secret') || key.includes('token')) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = redactValue(v);
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    if (/sk-[A-Za-z0-9]{10,}/.test(value) || /Bearer\s+\S+/i.test(value)) return '[REDACTED]';
  }
  return value;
}

export function logError(
  error: unknown,
  context: ErrorLogContext = {},
  errorReference?: string,
): PrivateErrorEntry {
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: PrivateErrorEntry = {
    errorReference: errorReference || randomUUID(),
    timestamp: new Date().toISOString(),
    message: err.message,
    name: err.name,
    stack: err.stack ?? null,
    route: context.route ?? null,
    method: context.method ?? null,
    userId: context.userId ?? null,
    sessionId: context.sessionId ?? null,
    statusCode: context.statusCode ?? 500,
    requestBody: redactValue(context.requestBody ?? null),
    environment: context.environment ?? process.env.NODE_ENV ?? 'unknown',
    frameworkVersion: context.frameworkVersion ?? process.env.npm_package_version ?? null,
    boundary: context.boundary ?? null,
    meta: context.meta ?? {},
  };
  store.push(entry);
  if (store.length > 20_000) {
    store.splice(0, store.length - 15_000);
  }
  const spike = detectFiveHundredSpike();
  for (const fn of listeners) {
    try {
      fn(entry, spike);
    } catch {
      // never throw from logger hooks
    }
  }
  return entry;
}

export function searchErrors(filters: ErrorSearchFilters = {}): PrivateErrorEntry[] {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const fromMs = filters.from ? Date.parse(filters.from) : null;
  const toMs = filters.to ? Date.parse(filters.to) : null;
  const out: PrivateErrorEntry[] = [];
  for (let i = store.length - 1; i >= 0 && out.length < limit; i -= 1) {
    const row = store[i]!;
    const t = Date.parse(row.timestamp);
    if (filters.errorReference && row.errorReference !== filters.errorReference) continue;
    if (filters.userId && row.userId !== filters.userId) continue;
    if (filters.route && !(row.route ?? '').includes(filters.route)) continue;
    if (filters.statusCode != null && row.statusCode !== filters.statusCode) continue;
    if (fromMs != null && t < fromMs) continue;
    if (toMs != null && t > toMs) continue;
    out.push(row);
  }
  return out;
}

export function getErrorContext(errorReference: string): PrivateErrorEntry | null {
  for (let i = store.length - 1; i >= 0; i -= 1) {
    if (store[i]!.errorReference === errorReference) return store[i]!;
  }
  return null;
}

export function detectFiveHundredSpike(
  windowMs = SPIKE_WINDOW_MS,
  threshold = SPIKE_THRESHOLD,
): SpikeAlert {
  const since = Date.now() - windowMs;
  const count = store.filter(
    (e) => e.statusCode >= 500 && Date.parse(e.timestamp) >= since,
  ).length;
  const triggered = count > threshold;
  return {
    triggered,
    count,
    windowMs,
    threshold,
    message: triggered
      ? `Spike: ${count} HTTP 5xx errors in ${Math.round(windowMs / 60000)} minutes (threshold ${threshold})`
      : `OK: ${count} HTTP 5xx in window`,
  };
}

export function onErrorLogged(
  listener: (entry: PrivateErrorEntry, spike: SpikeAlert) => void,
): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function clearErrorLogStore(): void {
  store.length = 0;
}

export function errorLogCount(): number {
  return store.length;
}
