import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockRedis(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    setex: vi.fn(async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    scan: vi.fn(async (cursor: string, _match: string, pattern: string) => {
      const prefix = pattern.replace('*', '');
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix));
      return cursor === '0' ? ['0', keys] : ['0', []];
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted += 1;
      }
      return deleted;
    }),
    store,
  };
}

async function loadCache(redis: ReturnType<typeof mockRedis> | null) {
  vi.doMock('../config/index.js', () => ({
    config: {
      cache: {
        ttlSeconds: {
          webSearch: 3600,
          propertyCompliance: 86400,
          aiClassification: 3600,
          marketData: { default: 1800, propertyData: 900 },
        },
      },
    },
  }));
  vi.doMock('../memory/redis.js', () => ({
    getRedis: () => redis,
  }));
  return import('./cache.js');
}

describe('withCache', () => {
  it('returns a cached value without executing the function on hit', async () => {
    const redis = mockRedis();
    const cache = await loadCache(redis);
    const key = cache.makeCacheKey('web-search', { query: 'base rate', count: 5 });
    redis.store.set(key, JSON.stringify([{ title: 'cached' }]));

    const fn = vi.fn(async () => [{ title: 'fresh' }]);
    const result = await cache.withCache('web-search', { count: 5, query: 'base rate' }, 3600, fn);

    expect(result).toEqual([{ title: 'cached' }]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('executes and stores on miss with the configured TTL', async () => {
    const redis = mockRedis();
    const cache = await loadCache(redis);
    const fn = vi.fn(async () => ({ ok: true }));

    const result = await cache.withCache('domain_lookup', { key: 'hmo' }, 86400, fn);

    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledOnce();
    expect(redis.setex).toHaveBeenCalledWith(
      expect.stringContaining('carina:tool-cache:domain_lookup:'),
      86400,
      JSON.stringify({ ok: true }),
    );
  });

  it('does not collide across different tools or reordered params', async () => {
    const cache = await loadCache(mockRedis());

    const first = cache.makeCacheKey('web-search', { query: 'x', count: 1 });
    const reordered = cache.makeCacheKey('web-search', { count: 1, query: 'x' });
    const otherTool = cache.makeCacheKey('domain_lookup', { count: 1, query: 'x' });

    expect(first).toBe(reordered);
    expect(first).not.toBe(otherTool);
  });

  it('falls back to execution when Redis is unavailable', async () => {
    const cache = await loadCache(null);
    const fn = vi.fn(async () => 'fresh');

    await expect(cache.withCache('web-search', { query: 'x' }, 3600, fn)).resolves.toBe('fresh');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('clears all cache keys or a single tool namespace', async () => {
    const redis = mockRedis();
    const cache = await loadCache(redis);
    redis.store.set(cache.makeCacheKey('web-search', { query: 'x' }), '"x"');
    redis.store.set(cache.makeCacheKey('domain_lookup', { key: 'hmo' }), '"hmo"');

    await expect(cache.clearToolCache('web-search')).resolves.toBe(1);
    expect([...redis.store.keys()]).toHaveLength(1);

    await expect(cache.clearToolCache()).resolves.toBe(1);
    expect([...redis.store.keys()]).toHaveLength(0);
  });
});

describe('getToolCacheTtlSeconds', () => {
  it('maps tool names to configured TTL categories', async () => {
    const cache = await loadCache(mockRedis());

    expect(cache.getToolCacheTtlSeconds('web-search')).toBe(3600);
    expect(cache.getToolCacheTtlSeconds('domain_lookup')).toBe(86400);
    expect(cache.getToolCacheTtlSeconds('property-data-lookup')).toBe(900);
    expect(cache.getToolCacheTtlSeconds('ai-classification')).toBe(3600);
    expect(cache.getToolCacheTtlSeconds('file-read')).toBeNull();
  });
});
