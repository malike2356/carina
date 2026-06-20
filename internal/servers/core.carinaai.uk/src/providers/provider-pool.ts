import { loadFromYamlSync } from '../cli/config/loader.js';
import { envKeyForProvider } from '../cli/config/env.js';
import type { ProviderName } from '../cli/config/defaults.js';
import type { FailoverConfig, ProviderError, ProviderProfile } from './provider-profile.js';

const DEFAULT_FAILOVER: FailoverConfig = {
  maxRetries: 2,
  cooldownMs: 60_000,
  failFast: true,
};

export function classifyProviderError(err: unknown): ProviderError {
  const status = (err as { status?: number }).status
    ?? (err as { statusCode?: number }).statusCode
    ?? (err as { response?: { status?: number } }).response?.status;
  if (status === 429) return { type: 'rate_limit', statusCode: 429 };
  if (status === 401 || status === 403) return { type: 'auth', statusCode: status };
  if (typeof status === 'number' && status >= 500) return { type: 'server_error', statusCode: status };
  if (status === 400 || status === 422) return { type: 'invalid_request', statusCode: status };
  const code = (err as { code?: string }).code;
  if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT') return { type: 'network' };
  return { type: 'unknown' };
}

export function isRetryableProviderError(error: ProviderError): boolean {
  return error.type !== 'invalid_request' && error.type !== 'auth';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolvePrimaryApiKey(provider: string): string | undefined {
  const yaml = loadFromYamlSync();
  const name = provider as ProviderName;
  const fromYaml = yaml.providers[name]?.api_key;
  if (fromYaml) return fromYaml;
  return process.env[envKeyForProvider(provider)];
}

export function buildProviderProfilesFromConfig(): {
  profiles: ProviderProfile[];
  failover: FailoverConfig;
} {
  const yaml = loadFromYamlSync();
  const extra = yaml.providerProfiles ?? [];
  if (extra.length === 0) {
    return { profiles: [], failover: yaml.failover ?? {} };
  }

  const provider = process.env.DEFAULT_PROVIDER ?? yaml.provider;
  const model = process.env.DEFAULT_MODEL ?? yaml.model;
  const profiles: ProviderProfile[] = [
    {
      name: 'primary',
      provider,
      apiKey: resolvePrimaryApiKey(provider),
      model,
      priority: 0,
      enabled: true,
    },
    ...extra.map((entry) => ({
      ...entry,
      enabled: entry.enabled ?? true,
    })),
  ];

  return { profiles, failover: yaml.failover ?? {} };
}

export function isProfilePoolEnabled(): boolean {
  return buildProviderProfilesFromConfig().profiles.length > 0;
}

export class ProviderPool {
  private profiles: ProviderProfile[];
  private failoverConfig: FailoverConfig;

  constructor(profiles: ProviderProfile[], config: FailoverConfig = DEFAULT_FAILOVER) {
    this.profiles = profiles.map((profile) => ({ ...profile }));
    this.profiles.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    this.failoverConfig = { ...DEFAULT_FAILOVER, ...config };
  }

  getAllProfiles(): ProviderProfile[] {
    return this.profiles.map((profile) => ({ ...profile }));
  }

  getAvailableProfiles(): ProviderProfile[] {
    const now = Date.now();
    return this.profiles.filter((profile) =>
      profile.enabled !== false
      && (!profile.cooldownUntil || profile.cooldownUntil < now),
    );
  }

  markFailed(profileName: string, error: ProviderError): void {
    const profile = this.profiles.find((entry) => entry.name === profileName);
    if (!profile) return;

    profile.failureCount = (profile.failureCount ?? 0) + 1;
    profile.lastFailureAt = Date.now();

    const baseCooldown = this.failoverConfig.cooldownMs ?? 60_000;
    const cooldown = error.statusCode === 429
      ? Math.min(baseCooldown * 2, 300_000)
      : baseCooldown;

    profile.cooldownUntil = Date.now() + cooldown;
    console.warn(
      `[failover] Profile "${profileName}" failed (${error.statusCode ?? error.type}). `
      + `In cooldown for ${Math.ceil(cooldown / 1000)}s.`,
    );
  }

  markSucceeded(profileName: string): void {
    const profile = this.profiles.find((entry) => entry.name === profileName);
    if (!profile) return;
    profile.failureCount = 0;
    profile.cooldownUntil = undefined;
  }

  resetAllCooldowns(): void {
    for (const profile of this.profiles) {
      profile.failureCount = 0;
      profile.cooldownUntil = undefined;
      profile.lastFailureAt = undefined;
    }
  }

  async withFailover<T>(fn: (profile: ProviderProfile) => Promise<T>): Promise<T> {
    const available = this.getAvailableProfiles();
    if (available.length === 0) {
      throw new Error('All provider profiles are in cooldown or disabled. Check your API keys.');
    }

    let lastError: Error | null = null;
    const maxRetries = this.failoverConfig.maxRetries ?? 2;

    for (const profile of available) {
      let retries = 0;
      while (retries <= maxRetries) {
        try {
          const result = await fn(profile);
          this.markSucceeded(profile.name);
          return result;
        } catch (err: unknown) {
          const providerError = classifyProviderError(err);

          if (providerError.type === 'invalid_request') {
            throw err;
          }

          if (providerError.type === 'auth') {
            this.markFailed(profile.name, providerError);
            lastError = err instanceof Error ? err : new Error(String(err));
            break;
          }

          if (!isRetryableProviderError(providerError)) {
            this.markFailed(profile.name, providerError);
            lastError = err instanceof Error ? err : new Error(String(err));
            break;
          }

          retries += 1;
          if (retries > maxRetries) {
            this.markFailed(profile.name, providerError);
            lastError = err instanceof Error ? err : new Error(String(err));
            break;
          }

          await delay(500 * retries);
        }
      }
    }

    throw lastError ?? new Error('All provider profiles failed');
  }
}

let pool: ProviderPool | null = null;

export function getProviderPool(): ProviderPool {
  if (!pool) {
    const { profiles, failover } = buildProviderProfilesFromConfig();
    pool = new ProviderPool(profiles, failover);
  }
  return pool;
}

export function resetProviderPool(): void {
  pool = null;
}

export function resetAllCooldowns(): void {
  getProviderPool().resetAllCooldowns();
}
