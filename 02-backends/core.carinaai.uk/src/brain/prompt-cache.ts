import crypto from 'crypto';
import { recordPromptCacheObservation } from '../telemetry/provider-observation.js';
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

export interface FrozenSessionPrompt {
  systemPrompt: string;
  frozenAt: number;
  skillSnapshot: string[];
  toolSnapshot: string[];
}

export interface SessionPromptCacheStats {
  hits: number;
  misses: number;
  hitRatePercent: number | null;
}

const DEFAULT_TTL_MS = Number(process.env.CARINA_PROMPT_CACHE_TTL_MS ?? 30 * 60 * 1000);
const MAX_ENTRIES = Number(process.env.CARINA_PROMPT_CACHE_MAX ?? 64);

const cache = new Map<string, PromptCacheEntry>();
const frozenSessionPrompts = new Map<string, FrozenSessionPrompt>();
const pendingInvalidations = new Map<string, { reason: string; requestedAt: number }>();
const sessionCacheStats = new Map<string, { hits: number; misses: number }>();
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
    recordPromptCacheObservation(true, cacheKey);
    return { systemPrompt: existing.systemPrompt, cacheKey, hit: true };
  }

  misses++;
  recordPromptCacheObservation(false, cacheKey);
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
  clearFrozenPromptState();
}

export function getPromptCacheStats(): PromptCacheStats {
  return { size: cache.size, hits, misses };
}

export function recordProviderCacheHit(provider: string, cacheKey: string): void {
  const entry = cache.get(cacheKey);
  if (entry) entry.provider = provider;
}

function recordSessionCacheObservation(sessionId: string, hit: boolean): void {
  const stats = sessionCacheStats.get(sessionId) ?? { hits: 0, misses: 0 };
  if (hit) stats.hits += 1;
  else stats.misses += 1;
  sessionCacheStats.set(sessionId, stats);
}

export function freezeSessionPrompt(
  sessionId: string,
  systemPrompt: string,
  skills: string[],
  tools: string[],
): void {
  if (frozenSessionPrompts.has(sessionId)) return;
  frozenSessionPrompts.set(sessionId, {
    systemPrompt,
    frozenAt: Date.now(),
    skillSnapshot: [...skills],
    toolSnapshot: [...tools],
  });
  recordSessionCacheObservation(sessionId, false);
}

export function getFrozenSystemPrompt(sessionId: string): string | null {
  return frozenSessionPrompts.get(sessionId)?.systemPrompt ?? null;
}

export function getFrozenSessionPrompt(sessionId: string): FrozenSessionPrompt | null {
  return frozenSessionPrompts.get(sessionId) ?? null;
}

export function deferPromptInvalidation(sessionId: string, reason: string): void {
  pendingInvalidations.set(sessionId, { reason, requestedAt: Date.now() });
  console.debug(`[prompt-cache] Deferred invalidation for session ${sessionId}: ${reason}`);
}

export function deferPromptInvalidationForAllFrozen(reason: string): number {
  let count = 0;
  for (const sessionId of frozenSessionPrompts.keys()) {
    deferPromptInvalidation(sessionId, reason);
    count += 1;
  }
  return count;
}

export function hasPendingInvalidation(sessionId: string): boolean {
  return pendingInvalidations.has(sessionId);
}

export function getPendingInvalidationReason(sessionId: string): string | null {
  return pendingInvalidations.get(sessionId)?.reason ?? null;
}

export function forceImmediateInvalidation(sessionId: string): void {
  frozenSessionPrompts.delete(sessionId);
  pendingInvalidations.delete(sessionId);
}

export function applyPendingInvalidation(sessionId: string): boolean {
  const hasPending = pendingInvalidations.has(sessionId);
  if (hasPending) {
    frozenSessionPrompts.delete(sessionId);
    pendingInvalidations.delete(sessionId);
  }
  return hasPending;
}

export function thawSession(sessionId: string): void {
  frozenSessionPrompts.delete(sessionId);
  pendingInvalidations.delete(sessionId);
  sessionCacheStats.delete(sessionId);
}

export function resolveFrozenSystemPrompt(
  sessionId: string,
  opts: { forceRebuild?: boolean } = {},
): string | null {
  if (opts.forceRebuild) {
    forceImmediateInvalidation(sessionId);
    return null;
  }
  const frozen = getFrozenSystemPrompt(sessionId);
  if (frozen) {
    recordSessionCacheObservation(sessionId, true);
  }
  return frozen;
}

export function getSessionPromptCacheStats(sessionId: string): SessionPromptCacheStats {
  const stats = sessionCacheStats.get(sessionId) ?? { hits: 0, misses: 0 };
  const total = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRatePercent: total > 0 ? Math.round((stats.hits / total) * 1000) / 10 : null,
  };
}

export function listFrozenSessionIds(): string[] {
  return [...frozenSessionPrompts.keys()];
}

export function clearFrozenPromptState(): void {
  frozenSessionPrompts.clear();
  pendingInvalidations.clear();
  sessionCacheStats.clear();
}
