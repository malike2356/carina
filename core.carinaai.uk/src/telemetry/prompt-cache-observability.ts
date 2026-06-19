import {
  getPromptCacheStats,
  getSessionPromptCacheStats,
  listFrozenSessionIds,
} from '../brain/prompt-cache.js';
import {
  listProviderObservations,
  summarizeProviderObservations,
  type ProviderObservation,
} from './provider-observation.js';

export type PromptCacheObservability = {
  enabled: boolean;
  stats: ReturnType<typeof getPromptCacheStats>;
  hitRatePercent: number | null;
  ringBuffer: ReturnType<typeof summarizeProviderObservations>;
  recent: ProviderObservation[];
  frozenSessions: Array<{
    sessionId: string;
    cache: ReturnType<typeof getSessionPromptCacheStats>;
  }>;
};

export function buildPromptCacheObservability(limit = 20): PromptCacheObservability {
  const stats = getPromptCacheStats();
  const total = stats.hits + stats.misses;
  const hitRatePercent = total > 0 ? Math.round((stats.hits / total) * 1000) / 10 : null;
  const recent = listProviderObservations(limit).filter(
    (o) => o.kind === 'cache_hit' || o.kind === 'cache_miss',
  );

  return {
    enabled: process.env.CARINA_PROMPT_CACHE === 'true',
    stats,
    hitRatePercent,
    ringBuffer: summarizeProviderObservations(),
    recent,
    frozenSessions: listFrozenSessionIds().map((sessionId) => ({
      sessionId,
      cache: getSessionPromptCacheStats(sessionId),
    })),
  };
}
