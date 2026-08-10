/**
 * Automated downtime detection and incident lifecycle.
 */
import type { MonitoredEndpoint, PingFn, PingResult } from './types.js';
import type { StatusStore } from './store.js';

export const DEFAULT_INTERVAL_MS = 60_000;
export const FAILURE_THRESHOLD = 3;
export const RECOVERY_MS = 5 * 60_000;

export async function defaultHttpPing(endpoint: MonitoredEndpoint): Promise<{
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  at?: string;
}> {
  const expect = endpoint.expectStatus ?? 200;
  const started = Date.now();
  try {
    const res = await fetch(endpoint.url, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000),
    });
    const latencyMs = Date.now() - started;
    return {
      ok: res.status === expect,
      statusCode: res.status,
      latencyMs,
      error: res.status === expect ? undefined : `unexpected status ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pingEndpoints(
  store: StatusStore,
  opts?: { pingFn?: PingFn; now?: string },
): Promise<PingResult[]> {
  const pingFn: PingFn = opts?.pingFn || defaultHttpPing;
  const at = opts?.now || new Date().toISOString();
  const results: PingResult[] = [];
  for (const ep of store.listEndpoints()) {
    const raw = await pingFn(ep);
    const row: PingResult = {
      endpointId: ep.id,
      ok: Boolean(raw.ok),
      statusCode: raw.statusCode,
      latencyMs: raw.latencyMs,
      error: raw.error,
      at: raw.at || at,
    };
    store.recordPing(row);
    results.push(row);
  }
  return results;
}

export function detectOutage(
  store: StatusStore,
  results: PingResult[],
): Array<{ endpointId: string; failures: number }> {
  const out: Array<{ endpointId: string; failures: number }> = [];
  for (const r of results) {
    if (r.ok) {
      store.setFailureStreak(r.endpointId, 0);
      continue;
    }
    const n = store.getFailureStreak(r.endpointId) + 1;
    store.setFailureStreak(r.endpointId, n);
    if (n >= FAILURE_THRESHOLD) {
      out.push({ endpointId: r.endpointId, failures: n });
    }
  }
  return out;
}

export function autoCreateIncident(
  store: StatusStore,
  endpointIds: string[],
  opts?: { now?: string },
): ReturnType<StatusStore['createIncident']> | null {
  const eps = store.listEndpoints().filter((e) => endpointIds.includes(e.id));
  if (eps.length === 0) return null;
  const already = eps.every((e) => store.getOpenIncidentId(e.id));
  if (already) {
    const id = store.getOpenIncidentId(eps[0].id);
    return id ? store.getIncident(id) || null : null;
  }
  const names = eps.map((e) => e.name).join(', ');
  return store.createIncident({
    title: `Outage detected: ${names}`,
    severity: eps.length > 1 ? 'critical' : 'major',
    affectedServices: eps.map((e) => e.id),
    autoCreated: true,
    message: `Health monitor recorded ${FAILURE_THRESHOLD}+ consecutive failures for: ${names}.`,
    detectedAt: opts?.now,
  });
}

export function resolveIncident(
  store: StatusStore,
  results: PingResult[],
  opts?: { now?: string; recoveryMs?: number },
): Array<NonNullable<ReturnType<StatusStore['getIncident']>>> {
  const recoveryMs = opts?.recoveryMs ?? RECOVERY_MS;
  const nowIso = opts?.now || new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const resolved: Array<NonNullable<ReturnType<StatusStore['getIncident']>>> = [];

  for (const r of results) {
    if (!r.ok) {
      store.setRecoverySince(r.endpointId, null);
      continue;
    }
    const openId = store.getOpenIncidentId(r.endpointId);
    if (!openId) {
      store.setRecoverySince(r.endpointId, null);
      continue;
    }
    let since = store.getRecoverySince(r.endpointId);
    if (!since) {
      store.setRecoverySince(r.endpointId, nowIso);
      since = nowIso;
    }
    if (nowMs - Date.parse(since) >= recoveryMs) {
      const incident = store.addIncidentUpdate(
        openId,
        'resolved',
        `Service recovered. Health checks succeeded for ${Math.round(recoveryMs / 60000)}+ minutes.`,
        nowIso,
      );
      if (incident) resolved.push(incident);
      store.setRecoverySince(r.endpointId, null);
    }
  }
  return resolved;
}

export async function runHealthCycle(
  store: StatusStore,
  opts?: { pingFn?: PingFn; now?: string; recoveryMs?: number },
): Promise<{
  pings: PingResult[];
  outages: Array<{ endpointId: string; failures: number }>;
  created: ReturnType<StatusStore['createIncident']> | null;
  resolved: Array<NonNullable<ReturnType<StatusStore['getIncident']>>>;
}> {
  const pings = await pingEndpoints(store, opts);
  const outages = detectOutage(store, pings);
  let created: ReturnType<StatusStore['createIncident']> | null = null;
  if (outages.length > 0) {
    created = autoCreateIncident(
      store,
      outages.map((o) => o.endpointId),
      { now: opts?.now },
    );
  }
  const resolved = resolveIncident(store, pings, opts);
  return { pings, outages, created, resolved };
}

/** Manual admin helpers */
export function manualCreateIncident(
  store: StatusStore,
  input: {
    title: string;
    affectedServices: string[];
    severity?: 'minor' | 'major' | 'critical';
    message?: string;
  },
) {
  return store.createIncident({ ...input, autoCreated: false });
}

export function manualUpdateIncident(
  store: StatusStore,
  incidentId: string,
  phase: 'investigating' | 'identified' | 'monitoring' | 'resolved',
  message: string,
) {
  return store.addIncidentUpdate(incidentId, phase, message);
}
