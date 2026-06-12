import { PROVIDER_MAP, providerBaseUrl, isProviderConfigured } from './provider-registry.js';

export type ProviderHealthState = 'healthy' | 'unhealthy' | 'unknown';

interface HealthEntry {
  state: ProviderHealthState;
  checkedAt: number;
  detail?: string;
}

const cache = new Map<string, HealthEntry>();

function ttlMs(): number {
  const raw = process.env.CARINA_PROVIDER_HEALTH_TTL_MS;
  const n = raw ? Number(raw) : 300_000;
  return Number.isFinite(n) && n > 0 ? n : 300_000;
}

function entryFor(name: string): HealthEntry {
  return cache.get(name) ?? { state: 'unknown', checkedAt: 0 };
}

function isFresh(entry: HealthEntry): boolean {
  if (entry.state === 'unknown') return false;
  return Date.now() - entry.checkedAt < ttlMs();
}

export function getProviderHealth(name: string): ProviderHealthState {
  const entry = entryFor(name);
  if (!isFresh(entry)) return 'unknown';
  return entry.state;
}

export function isProviderAvailable(name: string): boolean {
  const state = getProviderHealth(name);
  return state !== 'unhealthy';
}

export function markProviderHealthy(name: string): void {
  cache.set(name, { state: 'healthy', checkedAt: Date.now() });
}

export function markProviderUnhealthy(name: string, detail?: string): void {
  cache.set(name, { state: 'unhealthy', checkedAt: Date.now(), detail });
}

export function resetProviderHealth(name?: string): void {
  if (name) cache.delete(name);
  else cache.clear();
}

export function listProviderHealth(): Array<{ name: string; state: ProviderHealthState; detail?: string }> {
  return [...cache.entries()].map(([name, entry]) => ({
    name,
    state: isFresh(entry) ? entry.state : 'unknown',
    detail: entry.detail,
  }));
}

export async function probeProviderHealth(name: string): Promise<boolean> {
  const def = PROVIDER_MAP[name];
  if (!def || !isProviderConfigured(def)) {
    markProviderUnhealthy(name, 'not configured');
    return false;
  }

  if (!def.local) {
    markProviderHealthy(name);
    return true;
  }

  const base = providerBaseUrl(def);
  if (!base) {
    markProviderUnhealthy(name, 'missing base URL');
    return false;
  }

  const url = `${base}/models`;
  const timeout = Number(process.env.CARINA_PROVIDER_PROBE_TIMEOUT_MS ?? 2_000);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) {
      markProviderUnhealthy(name, `HTTP ${res.status}`);
      return false;
    }
    markProviderHealthy(name);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    markProviderUnhealthy(name, msg);
    return false;
  }
}

export async function probeConfiguredLocalProviders(names: string[]): Promise<void> {
  const locals = names.filter((n) => PROVIDER_MAP[n]?.local);
  await Promise.all(locals.map((n) => probeProviderHealth(n)));
}
