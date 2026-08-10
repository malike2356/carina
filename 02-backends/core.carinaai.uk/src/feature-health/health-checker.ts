/**
 * Smoke tests + metric-driven feature health status.
 */

import {
  getAllFeatures,
  updateFeatureHealth,
  type FeatureStatus,
  type RegisteredFeature,
} from './feature-registry.js';

export type SmokeResult = {
  endpoint: string;
  ok: boolean;
  statusCode: number | null;
  detail: string;
};

export type UsageMetrics = {
  activeUsers7d: number;
  adoptionRate: number;
};

export type HealthCheckDeps = {
  /** HTTP probe. Defaults to global fetch when available. */
  fetchFn?: (url: string) => Promise<{ status: number; ok: boolean }>;
  /** Error rate 0..1 over last 24h (preferred) or 7d. */
  getErrorRate?: (feature: string) => Promise<number> | number;
  /** Usage / adoption for last 7d. */
  getUsage?: (feature: string) => Promise<UsageMetrics> | UsageMetrics;
  /** Absolute or relative base for endpoint paths. */
  baseUrl?: string;
  /** Error rate threshold (fraction) above which a feature is broken. */
  errorRateBroken?: number;
  /** Error rate threshold (fraction) above which a feature is degraded. */
  errorRateDegraded?: number;
};

const DEFAULT_BROKEN = 0.05;
const DEFAULT_DEGRADED = 0.01;

async function defaultFetch(url: string): Promise<{ status: number; ok: boolean }> {
  if (typeof fetch !== 'function') {
    return { status: 0, ok: false };
  }
  const res = await fetch(url, { method: 'GET', redirect: 'manual' });
  return { status: res.status, ok: res.status >= 200 && res.status < 400 };
}

function resolveUrl(endpoint: string, baseUrl?: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  const base = (baseUrl ?? '').replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return base ? `${base}${path}` : path;
}

export function deriveStatus(input: {
  smokeOk: boolean;
  errorRate: number;
  errorRateBroken?: number;
  errorRateDegraded?: number;
}): FeatureStatus {
  const broken = input.errorRateBroken ?? DEFAULT_BROKEN;
  const degraded = input.errorRateDegraded ?? DEFAULT_DEGRADED;
  if (!input.smokeOk || input.errorRate > broken) return 'broken';
  if (input.errorRate > degraded) return 'degraded';
  return 'healthy';
}

export async function checkFeatureHealth(
  feature: RegisteredFeature,
  deps: HealthCheckDeps = {},
): Promise<{
  feature: RegisteredFeature;
  smokes: SmokeResult[];
  status: FeatureStatus;
}> {
  const fetchFn = deps.fetchFn ?? defaultFetch;
  const smokes: SmokeResult[] = [];

  if (feature.endpoints.length === 0) {
    smokes.push({
      endpoint: '(none)',
      ok: false,
      statusCode: null,
      detail: 'No endpoints registered',
    });
  } else {
    for (const endpoint of feature.endpoints) {
      const url = resolveUrl(endpoint, deps.baseUrl);
      try {
        const res = await fetchFn(url);
        smokes.push({
          endpoint,
          ok: res.ok,
          statusCode: res.status,
          detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} (expected 2xx/3xx)`,
        });
      } catch (err) {
        smokes.push({
          endpoint,
          ok: false,
          statusCode: null,
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const smokeOk = smokes.length > 0 && smokes.every((s) => s.ok);
  const errorRateRaw = deps.getErrorRate ? await deps.getErrorRate(feature.name) : 0;
  const errorRate = Math.max(0, Number(errorRateRaw) || 0);
  const usage = deps.getUsage
    ? await deps.getUsage(feature.name)
    : { activeUsers7d: 0, adoptionRate: 0 };

  const status = deriveStatus({
    smokeOk,
    errorRate,
    errorRateBroken: deps.errorRateBroken,
    errorRateDegraded: deps.errorRateDegraded,
  });

  const updated = updateFeatureHealth(feature.name, {
    status,
    activeUsers7d: usage.activeUsers7d,
    errorRate7d: errorRate,
    adoptionRate: usage.adoptionRate,
    lastTested: new Date().toISOString(),
  });

  return {
    feature: updated ?? feature,
    smokes,
    status,
  };
}

export async function checkAllFeatures(deps: HealthCheckDeps = {}): Promise<{
  checkedAt: string;
  results: Array<Awaited<ReturnType<typeof checkFeatureHealth>>>;
  summary: { healthy: number; degraded: number; broken: number };
}> {
  const features = getAllFeatures();
  const results = [];
  for (const feature of features) {
    results.push(await checkFeatureHealth(feature, deps));
  }
  const summary = {
    healthy: results.filter((r) => r.status === 'healthy').length,
    degraded: results.filter((r) => r.status === 'degraded').length,
    broken: results.filter((r) => r.status === 'broken').length,
  };
  return { checkedAt: new Date().toISOString(), results, summary };
}
