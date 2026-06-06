import { config } from '../config/index.js';
import { getRedis } from '../memory/redis.js';

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

const eventQueue: ScoutEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let scoutUnreachableWarned = false;

const METRICS_TTL_SECONDS = 360;
const DETECT_INTERVAL_MS = 60_000;
const sessionTimers = new Map<string, ReturnType<typeof setInterval>>();

function isEnabled(): boolean {
  return config.labyrinth.enabled && config.labyrinth.url !== '' && config.labyrinth.apiKey !== '';
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Scout-Key': config.labyrinth.apiKey,
  };
}

function isLikelySecret(value: string): boolean {
  return SECRET_PATTERNS.some((re) => re.test(value));
}

export function sanitiseParams(params: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && isLikelySecret(value)) {
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
    const res = await fetch(`${config.labyrinth.url}${path}`, {
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
    source: 'carina-agent',
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
    instance_id: config.labyrinth.instanceId,
  };

  if (call.sessionId) {
    event.session_id = call.sessionId;
  }

  eventQueue.push(event);
  scheduleFlush();

  void recordToolCall(call.sessionId ?? 'default-session', call.toolName, call.resultSummary.length);
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
  await multi.exec();

  ensureMetricsFlush(sessionId);
}

function ensureMetricsFlush(sessionId: string): void {
  if (sessionTimers.has(sessionId)) return;
  const timer = setInterval(() => {
    void flushMetricsToScout(config.labyrinth.instanceId, sessionId);
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
}

export async function flushMetricsToScout(
  instanceId: string,
  sessionId: string,
): Promise<void> {
  if (!isEnabled()) return;

  const redis = getRedis();
  if (!redis) return;

  const base = `scout:metrics:${sessionId}`;
  const [toolCalls, toolsUsed, totalLen, shellCount, httpCount] = await Promise.all([
    redis.get(`${base}:tool_calls`),
    redis.scard(`${base}:tools_used`),
    redis.get(`${base}:total_response_length`),
    redis.get(`${base}:shell_count`),
    redis.get(`${base}:http_count`),
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
  };

  await postToScout('/api/events', {
    instance_id: instanceId,
    session_id: sessionId,
    event_type: 'session_metrics',
    severity: 'info',
    source: 'carina-agent',
    description: JSON.stringify(metrics),
  });
}

export async function reportHeartbeat(): Promise<void> {
  if (!isEnabled()) return;
  await postToScout('/api/heartbeat', {
    instance_id: config.labyrinth.instanceId,
    name: config.labyrinth.instanceName,
  });
}

/** Reset unreachable warning flag (tests only). */
export function _resetScoutWarnFlag(): void {
  scoutUnreachableWarned = false;
}
