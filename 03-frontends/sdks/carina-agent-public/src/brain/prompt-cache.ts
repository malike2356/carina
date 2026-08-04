import crypto from 'crypto';
import type { Message } from '../types/index.js';

export interface PromptCacheEntry {
  hash: string;
  systemPrompt: string;
  createdAt: number;
  hits: number;
  provider?: string;
}

export interface PromptCacheStats {
  size: number;
  hits: number;
  misses: number;
}

const DEFAULT_TTL_MS = Number(process.env.CARINA_PROMPT_CACHE_TTL_MS ?? 30 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.CARINA_PROMPT_CACHE_MAX ?? 64);

const cache = new Map<string, PromptCacheEntry>();
let hits = 0;
let misses = 0;

export function hashPrompt(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export function extractSystemPrompt(messages: Message[]): string {
  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content);
  return systemParts.join('\n\n---\n\n');
}

export function getCachedSystemPrompt(messages: Message[]): {
  systemPrompt: string;
  cacheKey: string;
  hit: boolean;
} {
  const systemPrompt = extractSystemPrompt(messages);
  const cacheKey = hashPrompt(systemPrompt);
  const existing = cache.get(cacheKey);
  const now = Date.now();

  if (existing && now - existing.createdAt < DEFAULT_TTL_MS) {
    existing.hits++;
    hits++;
    return { systemPrompt: existing.systemPrompt, cacheKey, hit: true };
  }

  misses++;
  cache.set(cacheKey, { hash: cacheKey, systemPrompt, createdAt: now, hits: 0 });
  pruneCache();
  return { systemPrompt, cacheKey, hit: false };
}

function pruneCache(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const sorted = [...cache.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt);
  while (cache.size > MAX_ENTRIES && sorted.length > 0) {
    const [key] = sorted.shift()!;
    cache.delete(key);
  }
}

export function anthropicCacheControlBlocks(systemPrompt: string): Array<{
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}> {
  if (process.env.CARINA_PROMPT_CACHE !== 'true') {
    return [{ type: 'text', text: systemPrompt }];
  }
  const staticPart = systemPrompt.slice(0, Math.min(systemPrompt.length, 12_000));
  const dynamicPart = systemPrompt.slice(staticPart.length);
  const blocks: Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral' } }> = [
    { type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } },
  ];
  if (dynamicPart) blocks.push({ type: 'text', text: dynamicPart });
  return blocks;
}

export function openaiPromptCacheKey(systemPrompt: string): string | undefined {
  if (process.env.CARINA_PROMPT_CACHE !== 'true') return undefined;
  return hashPrompt(systemPrompt).slice(0, 32);
}

export function clearPromptCache(): void {
  cache.clear();
  hits = 0;
  misses = 0;
}

export function getPromptCacheStats(): PromptCacheStats {
  return { size: cache.size, hits, misses };
}

export function recordProviderCacheHit(provider: string, cacheKey: string): void {
  const entry = cache.get(cacheKey);
  if (entry) entry.provider = provider;
}
