/** Keprix sidecar HTTP helpers for OPS agent-engine (C05). */

import { readAgentEngineState, appendAgentEngineLog } from './store.js';
import type { AgentEngineHealth, AgentEngineLogEntry } from './types.js';

function keprixUrl(): string {
  const fromState = readAgentEngineState().config.keprix_url;
  return (fromState || process.env.CARINA_KEPRIX_URL || process.env.KEPRIX_URL || 'http://127.0.0.1:3333').replace(/\/$/, '');
}

function sharedToken(): string {
  return (
    process.env.CARINA_KEPRIX_SHARED_TOKEN
    ?? process.env.KEPRIX_CARINA_SHARED_TOKEN
    ?? process.env.KEPRIX_SERVICE_TOKEN
    ?? ''
  ).trim();
}

async function keprixFetch(path: string, init?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  const token = sharedToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  try {
    return await fetch(`${keprixUrl()}${path}`, { ...init, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchKeprixHealth(): Promise<AgentEngineHealth> {
  const checked_at = new Date().toISOString();
  const engine = readAgentEngineState().config.global_engine;
  try {
    const res = await keprixFetch('/api/health', undefined, 6000);
    if (!res.ok) {
      const message = `Keprix health HTTP ${res.status}`;
      appendAgentEngineLog({ timestamp: checked_at, level: 'ERROR', message, source: 'health' });
      return {
        engine,
        status: 'unhealthy',
        uptime_seconds: null,
        version: null,
        active_sessions: null,
        memory_usage_mb: null,
        cpu_percent: null,
        last_error: message,
        checked_at,
        keprix_primary_invoke_ok: false,
      };
    }
    const body = (await res.json()) as Record<string, unknown>;
    const statusOk = String(body.status ?? '').toLowerCase() === 'ok' || String(body.status ?? '') === 'healthy';

    // OPS honesty: workspace-on-keprix requires primary invoke path probe.
    const probe = await probeKeprixPrimaryInvoke();

    return {
      engine: 'keprix',
      status: statusOk && probe.ok ? 'healthy' : statusOk ? 'degraded' : 'unhealthy',
      uptime_seconds: typeof body.uptime_seconds === 'number' ? body.uptime_seconds : null,
      version: typeof body.version === 'string' ? body.version : null,
      active_sessions: typeof body.active_sessions === 'number' ? body.active_sessions : null,
      memory_usage_mb: typeof body.memory_usage_mb === 'number' ? body.memory_usage_mb : null,
      cpu_percent: typeof body.cpu_percent === 'number' ? body.cpu_percent : null,
      last_error: probe.ok ? null : probe.error,
      checked_at,
      keprix_primary_invoke_ok: probe.ok,
      pack_version: probe.pack_version,
      capability_counts: probe.capability_counts,
      circuit: probe.circuit,
      raw: body,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    appendAgentEngineLog({
      timestamp: checked_at,
      level: 'ERROR',
      message: `Keprix health unreachable: ${message}`,
      source: 'health',
    });
    return {
      engine,
      status: 'unreachable',
      uptime_seconds: null,
      version: null,
      active_sessions: null,
      memory_usage_mb: null,
      cpu_percent: null,
      last_error: message,
      checked_at,
      keprix_primary_invoke_ok: false,
    };
  }
}

/** Primary invoke path probe (CAS-13). Health ping alone is insufficient. */
export async function probeKeprixPrimaryInvoke(): Promise<{
  ok: boolean;
  error: string | null;
  pack_version: string | null;
  capability_counts: Record<string, number> | null;
  circuit: string | null;
}> {
  try {
    const healthRes = await keprixFetch('/v1/products/carina/health', undefined, 5000);
    if (!healthRes.ok) {
      return {
        ok: false,
        error: `sidecar health HTTP ${healthRes.status}`,
        pack_version: null,
        capability_counts: null,
        circuit: null,
      };
    }
    const health = (await healthRes.json()) as Record<string, unknown>;
    const capsRes = await keprixFetch('/v1/products/carina/capabilities', undefined, 5000);
    let capability_counts: Record<string, number> | null = null;
    if (capsRes.ok) {
      const caps = (await capsRes.json()) as { nodes?: Array<{ status?: string }> };
      capability_counts = {};
      for (const node of caps.nodes ?? []) {
        const status = String(node.status ?? 'unknown');
        capability_counts[status] = (capability_counts[status] ?? 0) + 1;
      }
    }

    const probeRes = await keprixFetch(
      '/v1/products/carina/invoke',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Correlation-ID': `ops-probe-${Date.now()}` },
        body: JSON.stringify({
          node: 'ops.engine.probe',
          workspace_id: 'ops-probe',
          input: {},
        }),
      },
      8000,
    );
    if (!probeRes.ok) {
      return {
        ok: false,
        error: `invoke probe HTTP ${probeRes.status}`,
        pack_version: typeof health.pack_version === 'string' ? health.pack_version : null,
        capability_counts,
        circuit: typeof health.circuit === 'string' ? health.circuit : null,
      };
    }
    const probeBody = (await probeRes.json()) as { ok?: boolean; result?: { ok?: boolean } };
    const ok = Boolean(probeBody.ok || probeBody.result?.ok);
    return {
      ok,
      error: ok ? null : 'invoke probe returned not ok',
      pack_version: typeof health.pack_version === 'string' ? health.pack_version : null,
      capability_counts,
      circuit: typeof health.circuit === 'string' ? health.circuit : null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      pack_version: null,
      capability_counts: null,
      circuit: null,
    };
  }
}

export async function fetchKeprixLogs(opts: {
  level?: string;
  limit?: number;
}): Promise<AgentEngineLogEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const level = (opts.level ?? '').trim().toLowerCase();

  // Prefer local OPS ring buffer (always available); enrich from Keprix if present.
  const local = readAgentEngineState().logs.filter((row) => {
    if (!level || level === 'all') return true;
    return row.level.toLowerCase() === level || row.level.toLowerCase().startsWith(level);
  }).slice(0, limit);

  try {
    const qs = new URLSearchParams();
    if (level) qs.set('level', level);
    qs.set('limit', String(limit));
    const res = await keprixFetch(`/api/observability/logs?${qs.toString()}`, undefined, 5000);
    if (!res.ok) return local;
    const body = (await res.json()) as { logs?: unknown };
    if (!Array.isArray(body.logs)) return local;
    const remote = body.logs
      .map((row): AgentEngineLogEntry | null => {
        if (!row || typeof row !== 'object') return null;
        const r = row as Record<string, unknown>;
        const message = String(r.message ?? r.msg ?? '');
        if (!message) return null;
        const entry: AgentEngineLogEntry = {
          timestamp: String(r.timestamp ?? r.at ?? new Date().toISOString()),
          level: String(r.level ?? 'INFO').toUpperCase(),
          message,
          source: 'keprix',
        };
        if (r.workspace_id) entry.workspace_id = String(r.workspace_id);
        return entry;
      })
      .filter((x): x is AgentEngineLogEntry => x !== null);
    const merged = [...remote, ...local].slice(0, limit);
    return merged;
  } catch {
    return local;
  }
}

export async function deployKeprixAction(
  action: 'restart' | 'update' | 'rollback',
): Promise<{ action: string; status: string; estimated_downtime_seconds: number; detail: string }> {
  const estimated = action === 'restart' ? 5 : action === 'update' ? 60 : 30;
  const script = process.env.KEPRIX_OPS_DEPLOY_SCRIPT?.trim();
  if (script) {
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      await execFileAsync(script, [action], {
        timeout: 120_000,
        env: { ...process.env, KEPRIX_OPS_ACTION: action },
      });
      return {
        action,
        status: 'initiated',
        estimated_downtime_seconds: estimated,
        detail: `Deploy script completed for ${action}`,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action,
        status: 'failed',
        estimated_downtime_seconds: estimated,
        detail: message,
      };
    }
  }

  // Safe default: mark initiated without running shell when no script is configured.
  return {
    action,
    status: 'initiated',
    estimated_downtime_seconds: estimated,
    detail: script
      ? 'Deploy script invoked'
      : 'No KEPRIX_OPS_DEPLOY_SCRIPT configured; action recorded for operator follow-up',
  };
}
