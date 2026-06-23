import { classifyError } from './error-classifier.js';

export type ProviderObservationKind = 'success' | 'fallback' | 'cache_hit' | 'cache_miss';

export type ProviderObservation = {
  ts: string;
  kind: ProviderObservationKind;
  provider: string;
  fromProvider?: string;
  model?: string;
  cacheKey?: string;
  errorClass?: string;
  message?: string;
};

const ring: ProviderObservation[] = [];
const MAX = 300;

function push(entry: ProviderObservation): void {
  ring.push(entry);
  if (ring.length > MAX) ring.splice(0, ring.length - MAX);
}

export function recordProviderSuccess(provider: string, model?: string): void {
  push({
    ts: new Date().toISOString(),
    kind: 'success',
    provider,
    model,
  });
}

export function recordProviderFallback(fromProvider: string, toProvider: string, err: unknown): void {
  const classified = classifyError(err, { provider: fromProvider });
  push({
    ts: new Date().toISOString(),
    kind: 'fallback',
    provider: toProvider,
    fromProvider,
    errorClass: classified.class,
    message: classified.message,
  });
}

export function recordPromptCacheObservation(hit: boolean, cacheKey: string, provider?: string): void {
  push({
    ts: new Date().toISOString(),
    kind: hit ? 'cache_hit' : 'cache_miss',
    provider: provider ?? 'unknown',
    cacheKey: cacheKey.slice(0, 16),
  });
}

export function listProviderObservations(limit = 50): ProviderObservation[] {
  return [...ring].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, limit);
}

export function summarizeProviderObservations(): {
  fallbacks: number;
  cacheHits: number;
  cacheMisses: number;
  successes: number;
} {
  const summary = { fallbacks: 0, cacheHits: 0, cacheMisses: 0, successes: 0 };
  for (const o of ring) {
    if (o.kind === 'fallback') summary.fallbacks += 1;
    if (o.kind === 'cache_hit') summary.cacheHits += 1;
    if (o.kind === 'cache_miss') summary.cacheMisses += 1;
    if (o.kind === 'success') summary.successes += 1;
  }
  return summary;
}

export function _resetProviderObservationsForTests(): void {
  ring.length = 0;
}
