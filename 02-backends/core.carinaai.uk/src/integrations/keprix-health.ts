import { isKeprixApiConfigured, keprixApiFetch, readKeprixConfig } from './keprix-api.js';

export type KeprixHealth = {
  healthy: boolean;
  checkedAt: string;
  latencyMs: number | null;
  reason: string;
};

let cached: { expiresAt: number; value: KeprixHealth } | undefined;

export async function probeKeprixHealth(force = false): Promise<KeprixHealth> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now) return cached.value;
  const config = readKeprixConfig();
  if (!isKeprixApiConfigured(config)) {
    const value: KeprixHealth = {
      healthy: false,
      checkedAt: new Date().toISOString(),
      latencyMs: null,
      reason: 'Keprix provider is not configured',
    };
    cached = { expiresAt: now + 30_000, value };
    return value;
  }
  const started = Date.now();
  try {
    const response = await keprixApiFetch('/health', { signal: AbortSignal.timeout(2_500) });
    const value: KeprixHealth = {
      healthy: response.ok,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      reason: response.ok ? 'Keprix health check passed' : `Keprix health returned HTTP ${response.status}`,
    };
    cached = { expiresAt: now + (response.ok ? 15_000 : 5_000), value };
    return value;
  } catch (err) {
    const value: KeprixHealth = {
      healthy: false,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      reason: err instanceof Error ? err.message : String(err),
    };
    cached = { expiresAt: now + 5_000, value };
    return value;
  }
}

export function clearKeprixHealthCacheForTests(): void {
  cached = undefined;
}
