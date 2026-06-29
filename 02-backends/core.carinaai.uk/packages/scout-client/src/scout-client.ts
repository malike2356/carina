import { config } from '#core/config/index.js';
import { getRedis } from '#core/memory/redis.js';
import { scoutContext } from '#core/security/scout-context.js';

export interface ScoutEvent {
  severity: 'info' | 'warning' | 'critical' | 'breach';
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  session_id?: string;
  instance_id?: string;
}

export interface ToolCallReport {
  toolName: string;
  params: Record<string, unknown>;
  resultSummary: string;
  durationMs: number;
  sessionId?: string;
  success: boolean;
  errorMessage?: string;
}

const SECRET_PATTERNS = [
  /^sk-[a-zA-Z0-9]{20,}$/,
  /^[a-f0-9]{64}$/,
  /^Bearer\s+\S+/i,
  /^Basic\s+[a-zA-Z0-9+/]+=*/i,
];
const SECRET_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|auth)/i;

const eventQueue: ScoutEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let scoutUnreachableWarned = false;

const METRICS_TTL_SECONDS = 360;
const DETECT_INTERVAL_MS = 10_000;
const METRICS_DEBOUNCE_MS = 2_000;
const metricsDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const sessionTimers = new Map<string, ReturnType<typeof setInterval>>();

function scoutBaseUrl(): string {
  return (config.labyrinth.url || process.env.LABYRINTH_URL || '').replace(/\/+$/, '');
}

function isEnabled(): boolean {
  const ctx = scoutContext.getStore();
  if (ctx) return scoutBaseUrl() !== '';
  return config.labyrinth.enabled && config.labyrinth.url !== '' && config.labyrinth.apiKey !== '';
}

function headers(): Record<string, string> {
  const ctx = scoutContext.getStore();
  const apiKey = ctx?.apiKey ?? config.labyrinth.apiKey;
  return {
    'Content-Type': 'application/json',
    'X-Scout-Key': apiKey,
  };
}

function resolveInstanceId(fallback?: string): string {
  const ctx = scoutContext.getStore();
  return ctx?.instanceId ?? fallback ?? config.labyrinth.instanceId;
}

function resolveInstanceName(): string {
  const ctx = scoutContext.getStore();
  return ctx?.instanceName ?? config.labyrinth.instanceName;
}

function isLikelySecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

export function sanitiseParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && (SECRET_KEY_PATTERN.test(key) || isLikelySecret(value))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result[key] = sanitiseParams(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

async function postToScout(path: string, body: unknown): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${scoutBaseUrl()}${path}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok && process.env.NODE_ENV !== 'production') {
      const text = await res.text().catch(() => '');
      console.warn(`[carina:scout] Scout returned ${res.status}: ${text}`);
    }
  } catch (err) {
    if (!scoutUnreachableWarned) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[carina:scout] Scout unreachable: ${msg}. Subsequent failures silent.`);
      scoutUnreachableWarned = true;
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function flushQueue(): Promise<void> {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, eventQueue.length);
  for (const event of batch) {
    await postToScout('/api/events', event);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, 100);
}

export async function reportEvent(event: ScoutEvent): Promise<void> {
  if (!isEnabled()) return;
  eventQueue.push(event);
  scheduleFlush();
}

export async function reportToolCall(call: ToolCallReport): Promise<void> {
  if (!isEnabled()) return;

  const sanitised = sanitiseParams(call.params);

  const event: ScoutEvent = {
    severity: call.success ? 'info' : 'warning',
    source: 'carina-aiva',
    event_type: 'tool_call',
    description: call.success
      ? `Tool ${call.toolName} executed (${call.durationMs}ms)`
      : `Tool ${call.toolName} failed: ${call.errorMessage ?? 'unknown error'}`,
    metadata: {
      tool_name: call.toolName,
      params: sanitised,
      result_summary: call.resultSummary,
      duration_ms: call.durationMs,
      success: call.success,
    },
    instance_id: resolveInstanceId(),
  };

  if (call.sessionId) {
    event.session_id = call.sessionId;
  }

  eventQueue.push(event);
  scheduleFlush();

  const sessionId = call.sessionId ?? 'default-session';
  void recordToolCall(sessionId, call.toolName, call.resultSummary.length);
  scheduleMetricsFlush(sessionId);
}

function scheduleMetricsFlush(sessionId: string): void {
  const existing = metricsDebounceTimers.get(sessionId);
  if (existing) clearTimeout(existing);
  metricsDebounceTimers.set(
    sessionId,
    setTimeout(() => {
      metricsDebounceTimers.delete(sessionId);
      void flushMetricsToScout(resolveInstanceId(), sessionId);
    }, METRICS_DEBOUNCE_MS),
  );
}

export async function recordToolCall(
  sessionId: string,
  toolName: string,
  responseLength: number,
): Promise<void> {
  if (!isEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  const base = `scout:metrics:${sessionId}`;
  const multi = redis.multi();
  multi.incr(`${base}:tool_calls`);
  multi.expire(`${base}:tool_calls`, METRICS_TTL_SECONDS);
  multi.sadd(`${base}:tools_used`, toolName);
  multi.expire(`${base}:tools_used`, METRICS_TTL_SECONDS);
  multi.incrby(`${base}:total_response_length`, responseLength);
  multi.expire(`${base}:total_response_length`, METRICS_TTL_SECONDS);
  if (toolName === 'shell-exec') {
    multi.incr(`${base}:shell_count`);
    multi.expire(`${base}:shell_count`, METRICS_TTL_SECONDS);
  }
  if (toolName === 'http-request') {
    multi.incr(`${base}:http_count`);
    multi.expire(`${base}:http_count`, METRICS_TTL_SECONDS);
  }
  multi.rpush(`${base}:tool_sequence`, toolName);
  multi.ltrim(`${base}:tool_sequence`, -32, -1);
  multi.expire(`${base}:tool_sequence`, METRICS_TTL_SECONDS);
  await multi.exec();

  ensureMetricsFlush(sessionId);
}

function ensureMetricsFlush(sessionId: string): void {
  if (sessionTimers.has(sessionId)) return;
  const timer = setInterval(() => {
    void flushMetricsToScout(resolveInstanceId(), sessionId);
  }, DETECT_INTERVAL_MS);
  sessionTimers.set(sessionId, timer);
}

export function stopMetricsFlush(sessionId: string): void {
  const timer = sessionTimers.get(sessionId);
  if (timer) {
    clearInterval(timer);
    sessionTimers.delete(sessionId);
  }
}

/** Reset session metric timers (tests only). */
export function _resetMetricsTimers(): void {
  for (const timer of sessionTimers.values()) {
    clearInterval(timer);
  }
  sessionTimers.clear();
  for (const timer of metricsDebounceTimers.values()) {
    clearTimeout(timer);
  }
  metricsDebounceTimers.clear();
}

export async function flushMetricsToScout(
  instanceId: string,
  sessionId: string,
): Promise<void> {
  if (!isEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  const base = `scout:metrics:${sessionId}`;
  const [toolCalls, toolsUsed, totalLen, shellCount, httpCount, toolSequence] = await Promise.all([
    redis.get(`${base}:tool_calls`),
    redis.scard(`${base}:tools_used`),
    redis.get(`${base}:total_response_length`),
    redis.get(`${base}:shell_count`),
    redis.get(`${base}:http_count`),
    redis.lrange(`${base}:tool_sequence`, 0, -1),
  ]);

  const tc = Number(toolCalls ?? 0);
  const metrics = {
    tool_calls_per_5min: tc,
    unique_tools_used: toolsUsed,
    avg_response_length: tc > 0 ? Number(totalLen ?? 0) / tc : 0,
    shell_exec_count: Number(shellCount ?? 0),
    http_request_count: Number(httpCount ?? 0),
    injection_attempt_count: 0,
    egress_blocked_count: 0,
    tool_sequence: toolSequence,
    hour_utc: new Date().getUTCHours(),
  };

  await postToScout('/api/events', {
    instance_id: instanceId,
    session_id: sessionId,
    event_type: 'session_metrics',
    severity: 'info',
    source: 'carina-aiva',
    description: JSON.stringify(metrics),
  });
}

export async function reportHeartbeat(): Promise<void> {
  if (!isEnabled()) return;
  await postToScout('/api/heartbeat', {
    instance_id: resolveInstanceId(),
    name: resolveInstanceName(),
  });
}

/** Reset unreachable warning flag (tests only). */
export function _resetScoutWarnFlag(): void {
  scoutUnreachableWarned = false;
}
