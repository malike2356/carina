import { pool } from '../../db.js';
import { config } from '../../config/index.js';
import type { VerificationScoreResult } from './verification-types.js';

export interface EndpointProbeResult {
  url: string;
  ok: boolean;
  status: number | null;
  https: boolean;
  latencyMs: number | null;
  error?: string;
}

export interface WavScoreInput {
  endpoints?: string[];
  fetchFn?: typeof fetch;
  timeoutMs?: number;
}

export async function probeEndpoint(
  url: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 8000,
): Promise<EndpointProbeResult> {
  const parsed = new URL(url);
  const https = parsed.protocol === 'https:';

  if (!https) {
    return {
      url,
      ok: false,
      status: null,
      https: false,
      latencyMs: null,
      error: 'Endpoint must use HTTPS',
    };
  }

  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchFn(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { Accept: 'application/json, text/html, */*' },
    });
    clearTimeout(timer);

    return {
      url,
      ok: response.ok || response.status < 500,
      status: response.status,
      https: true,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      url,
      ok: false,
      status: null,
      https: true,
      latencyMs: null,
      error: msg,
    };
  }
}

async function loadVulnerabilitySignals(): Promise<{
  runtimeIncidents30d: number;
  injectionBlocks30d: number;
  breach30d: number;
  egressBlocks30d: number;
}> {
  const result = await pool.query<{
    runtime_incidents_30d: string;
    injection_blocks_30d: string;
    breach_30d: string;
    egress_blocks_30d: string;
  }>(
    `SELECT
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND severity IN ('critical', 'breach')
       )::text AS runtime_incidents_30d,
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND event_type ~ 'injection'
       )::text AS injection_blocks_30d,
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND severity = 'breach'
       )::text AS breach_30d,
       COUNT(*) FILTER (
         WHERE created_at > NOW() - INTERVAL '30 days'
           AND event_type ~ 'egress'
       )::text AS egress_blocks_30d
     FROM security_events`,
  );

  const row = result.rows[0];
  return {
    runtimeIncidents30d: parseInt(row?.runtime_incidents_30d ?? '0', 10),
    injectionBlocks30d: parseInt(row?.injection_blocks_30d ?? '0', 10),
    breach30d: parseInt(row?.breach_30d ?? '0', 10),
    egressBlocks30d: parseInt(row?.egress_blocks_30d ?? '0', 10),
  };
}

export async function computeWavRiskScore(input: WavScoreInput = {}): Promise<VerificationScoreResult> {
  const endpoints = input.endpoints ?? config.trust.wavEndpoints;
  if (endpoints.length === 0) {
    return {
      applicable: false,
      risk_score: 100,
      notes: 'No HTTPS endpoints configured for WAV',
      checks: { endpointsConfigured: 0 },
    };
  }

  const fetchFn = input.fetchFn ?? fetch;
  const probes = await Promise.all(
    endpoints.map((url) => probeEndpoint(url, fetchFn, input.timeoutMs)),
  );

  const vulns = await loadVulnerabilitySignals();

  let risk = 10;
  const reachable = probes.filter((probe) => probe.ok).length;
  const unreachable = probes.length - reachable;

  risk += unreachable * 25;
  risk += vulns.runtimeIncidents30d * 15;
  risk += vulns.breach30d * 20;
  risk += Math.min(20, vulns.injectionBlocks30d * 2);
  risk += Math.min(10, vulns.egressBlocks30d);

  const slow = probes.filter((probe) => probe.latencyMs !== null && probe.latencyMs > 5000).length;
  risk += slow * 5;

  const riskScore = Math.min(100, Math.max(0, Math.round(risk)));
  const notes = unreachable === 0
    ? `All ${probes.length} HTTPS endpoint(s) reachable. No critical vulnerability signals in 30d.`
    : `${unreachable} of ${probes.length} endpoint(s) unreachable or unhealthy.`;

  return {
    applicable: true,
    risk_score: riskScore,
    notes,
    checks: {
      endpointsTotal: probes.length,
      endpointsReachable: reachable,
      runtimeIncidents30d: vulns.runtimeIncidents30d,
      injectionBlocks30d: vulns.injectionBlocks30d,
      breach30d: vulns.breach30d,
      probes: probes.map((probe) => ({
        url: probe.url,
        ok: probe.ok,
        status: probe.status,
        latencyMs: probe.latencyMs,
      })),
    },
  };
}
