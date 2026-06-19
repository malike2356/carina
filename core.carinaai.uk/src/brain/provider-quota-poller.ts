import fs from 'node:fs';
import path from 'node:path';
import { CARINA_HOME } from '../config/paths.js';
import type { ScheduledTask } from '../agents/scheduled-tasks.js';

export type ProviderQuotaSnapshot = {
  provider: string;
  checkedAt: string;
  remainingRequests?: number;
  remainingTokens?: number;
  resetAt?: string;
  source: 'headers' | 'api' | 'estimate';
  note?: string;
};

type QuotaStore = {
  updatedAt: string;
  providers: ProviderQuotaSnapshot[];
};

const latestHeaders = new Map<string, Partial<ProviderQuotaSnapshot>>();

function storePath(homeDir = CARINA_HOME): string {
  return path.join(homeDir, 'data', 'provider-quota.json');
}

export function recordProviderRateLimitHeaders(
  provider: string,
  headers: Record<string, string | string[] | undefined>,
): void {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v[0] : v]),
  );
  const remainingRequests = Number(lower['x-ratelimit-remaining-requests'] ?? lower['x-ratelimit-remaining']);
  const remainingTokens = Number(lower['x-ratelimit-remaining-tokens']);
  const resetAt = lower['x-ratelimit-reset-requests'] ?? lower['x-ratelimit-reset'];
  if (!Number.isFinite(remainingRequests) && !Number.isFinite(remainingTokens) && !resetAt) return;

  latestHeaders.set(provider, {
    provider,
    checkedAt: new Date().toISOString(),
    remainingRequests: Number.isFinite(remainingRequests) ? remainingRequests : undefined,
    remainingTokens: Number.isFinite(remainingTokens) ? remainingTokens : undefined,
    resetAt: resetAt ? String(resetAt) : undefined,
    source: 'headers',
  });
}

export function readProviderQuotaStore(homeDir = CARINA_HOME): QuotaStore {
  const file = storePath(homeDir);
  if (!fs.existsSync(file)) {
    return { updatedAt: new Date(0).toISOString(), providers: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as QuotaStore;
  } catch {
    return { updatedAt: new Date(0).toISOString(), providers: [] };
  }
}

async function pollOpenAIUsage(): Promise<ProviderQuotaSnapshot | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/usage', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      return {
        provider: 'openai',
        checkedAt: new Date().toISOString(),
        source: 'api',
        note: `usage endpoint HTTP ${res.status}`,
      };
    }
    return {
      provider: 'openai',
      checkedAt: new Date().toISOString(),
      source: 'api',
      note: 'usage endpoint reachable',
    };
  } catch (err) {
    return {
      provider: 'openai',
      checkedAt: new Date().toISOString(),
      source: 'api',
      note: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function pollProviderQuotas(homeDir = CARINA_HOME): Promise<QuotaStore> {
  const providers: ProviderQuotaSnapshot[] = [];

  for (const snap of latestHeaders.values()) {
    providers.push({
      provider: snap.provider ?? 'unknown',
      checkedAt: snap.checkedAt ?? new Date().toISOString(),
      remainingRequests: snap.remainingRequests,
      remainingTokens: snap.remainingTokens,
      resetAt: snap.resetAt,
      source: 'headers',
    });
  }

  const openai = await pollOpenAIUsage();
  if (openai) providers.push(openai);

  const store: QuotaStore = {
    updatedAt: new Date().toISOString(),
    providers,
  };

  const dir = path.dirname(storePath(homeDir));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(storePath(homeDir), JSON.stringify(store, null, 2));
  return store;
}

export function providerQuotaPollingEnabled(): boolean {
  return process.env.CARINA_PROVIDER_QUOTA_POLL !== 'false';
}

export function createProviderQuotaPollTask(): ScheduledTask {
  return {
    name: 'provider-quota-poll',
    hour: Number(process.env.CARINA_PROVIDER_QUOTA_HOUR ?? '4'),
    minute: Number(process.env.CARINA_PROVIDER_QUOTA_MINUTE ?? '15'),
    run: async () => {
      if (!providerQuotaPollingEnabled()) return;
      await pollProviderQuotas();
    },
  };
}
