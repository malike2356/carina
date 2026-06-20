import { createHash } from 'crypto';
import type { Redis } from 'ioredis';
import { config } from '../config/index.js';
import { getRedis } from '../memory/redis.js';

const CACHE_KEY_PREFIX = 'carina:tool-cache';

export interface CacheOptions {
  redis?: Redis | null;
  namespace?: string;
}

export type CacheStatus = 'hit' | 'miss' | 'disabled';

export interface CacheEvent {
  toolName: string;
  status: CacheStatus;
  key: string;
  ttlSeconds: number;
}

export type CacheReporter = (event: CacheEvent) => void;

let cacheReporter: CacheReporter | null = null;

export function setCacheReporter(reporter: CacheReporter | null): void {
  cacheReporter = reporter;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function makeCacheKey(
  toolName: string,
  params: Record<string, unknown>,
  namespace = CACHE_KEY_PREFIX,
): string {
  const hash = createHash('sha256')
    .update(stableStringify(params))
    .digest('hex');
  return `${namespace}:${toolName}:${hash}`;
}

export function getToolCacheTtlSeconds(
  toolName: string,
  params: Record<string, unknown> = {},
): number | null {
  if (toolName === 'web-search') return config.cache.ttlSeconds.webSearch;
  if (toolName === 'domain_lookup') return config.cache.ttlSeconds.propertyCompliance;
  if (toolName === 'land-registry-search') return config.cache.ttlSeconds.propertyCompliance;
  if (toolName === 'property-data-lookup') {
    const source = String(params.source ?? 'propertyData');
    const marketDataTtls: Record<string, number> = config.cache.ttlSeconds.marketData;
    return marketDataTtls[source] ?? config.cache.ttlSeconds.marketData.default;
  }
  if (toolName === 'ai-classification' || toolName === 'task-classification') {
    return config.cache.ttlSeconds.aiClassification;
  }
  return null;
}

export async function withCache<T>(
  toolName: string,
  params: Record<string, unknown>,
  ttlSeconds: number | null,
  fn: () => Promise<T>,
  options: CacheOptions = {},
): Promise<T> {
  const redis = options.redis === undefined ? getRedis() : options.redis;
  const enabled = ttlSeconds !== null && ttlSeconds > 0 && redis !== null;
  const key = makeCacheKey(toolName, params, options.namespace);

  if (!enabled) {
    cacheReporter?.({ toolName, status: 'disabled', key, ttlSeconds: ttlSeconds ?? 0 });
    return fn();
  }

  try {
    const cached = await redis.get(key);
    if (cached !== null) {
      cacheReporter?.({ toolName, status: 'hit', key, ttlSeconds });
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn(`[tool-cache] read failed for ${toolName}:`, err);
  }

  cacheReporter?.({ toolName, status: 'miss', key, ttlSeconds });
  const result = await fn();

  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(result));
  } catch (err) {
    console.warn(`[tool-cache] write failed for ${toolName}:`, err);
  }

  return result;
}

export async function clearToolCache(
  toolName?: string,
  options: CacheOptions = {},
): Promise<number> {
  const redis = options.redis === undefined ? getRedis() : options.redis;
  if (!redis) return 0;

  const namespace = options.namespace ?? CACHE_KEY_PREFIX;
  const pattern = toolName ? `${namespace}:${toolName}:*` : `${namespace}:*`;
  let cursor = '0';
  let deleted = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== '0');

  return deleted;
}
