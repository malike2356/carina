import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetProviderObservationsForTests,
  recordPromptCacheObservation,
} from './provider-observation.js';
import { buildPromptCacheObservability } from './prompt-cache-observability.js';
import { clearPromptCache, getCachedSystemPrompt } from '../brain/prompt-cache.js';

describe('prompt-cache-observability', () => {
  afterEach(() => {
    _resetProviderObservationsForTests();
    clearPromptCache();
    delete process.env.CARINA_PROMPT_CACHE;
  });

  it('reports hit rate from cache stats and ring buffer', () => {
    process.env.CARINA_PROMPT_CACHE = 'true';
    recordPromptCacheObservation(true, 'abc123');
    recordPromptCacheObservation(false, 'def456');
    getCachedSystemPrompt([
      { role: 'system', content: 'hello', timestamp: new Date() },
      { role: 'user', content: 'hi', timestamp: new Date() },
    ]);

    const obs = buildPromptCacheObservability();
    expect(obs.enabled).toBe(true);
    expect(obs.stats.hits + obs.stats.misses).toBeGreaterThan(0);
    expect(obs.recent.length).toBeGreaterThan(0);
  });
});
