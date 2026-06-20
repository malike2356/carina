import type { SearchCacheEntry } from './types.js';

export class SearchCache {
  private store = new Map<string, SearchCacheEntry<unknown>>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key) as SearchCacheEntry<T> | undefined;
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  invalidate(pattern: string): void {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key);
    }
  }

  clear(): void {
    this.store.clear();
  }
}

export const searchCache = new SearchCache();

export const SEARCH_TTL_MS = 5 * 60 * 1000;
export const DETAIL_TTL_MS = 60 * 60 * 1000;
export const HEALTH_TTL_MS = 10 * 60 * 1000;
