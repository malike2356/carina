import { PROVIDER_MAP } from '../brain/provider-registry.js';
import { loadCredentialsFile, saveCredentialsFile } from './store.js';
import type { KeyFailureReason, ProviderPoolState } from './types.js';

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;

function parseEnvPool(poolEnv?: string): string[] {
  if (!poolEnv?.trim()) return [];
  return poolEnv.split(',').map((k) => k.trim()).filter(Boolean);
}

function uniqueKeys(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function freshPoolState(keys: string[]): ProviderPoolState {
  return { keys, index: 0, failures: {} };
}

export class CredentialPoolManager {
  private cooldownMs: number;

  constructor(cooldownMs = DEFAULT_COOLDOWN_MS) {
    this.cooldownMs = cooldownMs;
  }

  resolveKeys(provider: string, singleKey = '', poolEnv?: string): string[] {
    const fromEnv = parseEnvPool(poolEnv);
    const stored = loadCredentialsFile().pools[provider]?.keys ?? [];
    if (fromEnv.length > 0 || stored.length > 0) {
      return uniqueKeys([...fromEnv, ...stored]);
    }
    return singleKey ? [singleKey] : [];
  }

  poolSize(provider: string, singleKey = '', poolEnv?: string): number {
    return this.resolveKeys(provider, singleKey, poolEnv).length;
  }

  nextKey(provider: string, singleKey = '', poolEnv?: string): string {
    const keys = this.resolveKeys(provider, singleKey, poolEnv);
    if (keys.length === 0) return singleKey;
    if (keys.length === 1) return keys[0]!;

    const data = loadCredentialsFile();
    let state = data.pools[provider];
    if (!state || state.keys.join() !== keys.join()) {
      state = freshPoolState(keys);
      data.pools[provider] = state;
      saveCredentialsFile(data);
    }

    const now = Date.now();
    const available = keys.filter((key) => {
      const failure = state!.failures[key];
      return !failure || failure.until <= now;
    });
    const pool = available.length > 0 ? available : keys;
    const key = pool[state.index % pool.length]!;
    state.index = (state.index + 1) % Math.max(pool.length, 1);
    data.pools[provider] = state;
    saveCredentialsFile(data);
    return key;
  }

  reportFailure(provider: string, key: string, reason: KeyFailureReason): void {
    if (!key) return;
    const data = loadCredentialsFile();
    const state = data.pools[provider] ?? freshPoolState([key]);
    const prev = state.failures[key];
    const count = (prev?.count ?? 0) + 1;
    state.failures[key] = {
      count,
      reason,
      until: Date.now() + this.cooldownMs * Math.min(count, 6),
    };
    data.pools[provider] = state;
    saveCredentialsFile(data);
  }

  rotate(provider: string): string {
    const def = PROVIDER_MAP[provider];
    const single = def ? (process.env[def.apiKeyEnv] ?? '') : '';
    const poolEnv = def ? process.env[def.apiKeysPoolEnv] : undefined;
    const keys = this.resolveKeys(provider, single, poolEnv);
    if (keys.length === 0) return '';

    const data = loadCredentialsFile();
    const state = data.pools[provider] ?? freshPoolState(keys);
    state.index = (state.index + 1) % keys.length;
    data.pools[provider] = state;
    saveCredentialsFile(data);
    return keys[state.index % keys.length]!;
  }

  addKey(provider: string, apiKey: string): void {
    const def = PROVIDER_MAP[provider];
    const single = def ? (process.env[def.apiKeyEnv] ?? '') : '';
    const poolEnv = def ? process.env[def.apiKeysPoolEnv] : undefined;
    const keys = uniqueKeys([...this.resolveKeys(provider, single, poolEnv), apiKey]);
    const data = loadCredentialsFile();
    data.pools[provider] = {
      ...(data.pools[provider] ?? freshPoolState(keys)),
      keys,
    };
    saveCredentialsFile(data);
  }

  describePool(provider: string): {
    provider: string;
    size: number;
    index: number;
    keys: Array<{ redacted: string; coolingDown: boolean; failures: number }>;
  } {
    const def = PROVIDER_MAP[provider];
    const single = def ? (process.env[def.apiKeyEnv] ?? '') : '';
    const poolEnv = def ? process.env[def.apiKeysPoolEnv] : undefined;
    const keys = this.resolveKeys(provider, single, poolEnv);
    const state = loadCredentialsFile().pools[provider];
    const now = Date.now();
    return {
      provider,
      size: keys.length,
      index: state?.index ?? 0,
      keys: keys.map((key) => {
        const failure = state?.failures[key];
        return {
          redacted: key.length <= 8 ? '***' : `${key.slice(0, 4)}...${key.slice(-4)}`,
          coolingDown: Boolean(failure && failure.until > now),
          failures: failure?.count ?? 0,
        };
      }),
    };
  }

  reset(): void {
    saveCredentialsFile({ version: 1, pools: {}, oauth: {} });
  }
}

let manager: CredentialPoolManager | null = null;

export function getCredentialPoolManager(): CredentialPoolManager {
  if (!manager) manager = new CredentialPoolManager();
  return manager;
}

export function resetCredentialPoolManager(): void {
  manager = null;
}
