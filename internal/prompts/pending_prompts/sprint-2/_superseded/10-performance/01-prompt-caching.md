# Prompt 01: Prompt Caching with Redis


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Many Carina tool calls and system prompt generations are identical across sessions. Without
caching, the same prompt is re-sent to the LLM provider on every request. A Redis cache
keyed by SHA-256 of the prompt reduces LLM costs and latency for repeated operations.

## What to Build

### 1. Cache layer

Create `src/brain/prompt-cache.ts`:
```typescript
import { createHash } from 'crypto';
import type { Redis } from 'ioredis';

export type CacheOptions = {
  ttlSeconds: number;
  namespace?: string;
};

export class PromptCache {
  constructor(private redis: Redis) {}

  private key(namespace: string, prompt: string, model: string): string {
    const hash = createHash('sha256').update(`${model}:${prompt}`).digest('hex');
    return `prompt-cache:${namespace}:${hash}`;
  }

  async get(namespace: string, prompt: string, model: string): Promise<string | null> {
    return this.redis.get(this.key(namespace, prompt, model));
  }

  async set(namespace: string, prompt: string, model: string, response: string, ttlSeconds: number): Promise<void> {
    await this.redis.setex(this.key(namespace, prompt, model), ttlSeconds, response);
  }

  async invalidate(namespace: string): Promise<void> {
    const pattern = `prompt-cache:${namespace}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) await this.redis.del(...keys);
  }

  async stats(): Promise<{ entries: number; memoryBytes: number }> {
    const keys = await this.redis.keys('prompt-cache:*');
    return { entries: keys.length, memoryBytes: 0 }; // memory tracking via Redis INFO
  }
}

export const promptCache = new PromptCache(redis);
```

### 2. Integration with LLM router

In `src/brain/LLMRouter.ts`, wrap completions with cache check:
```typescript
export async function complete(prompt: string, model: string, opts: CompletionOptions): Promise<string> {
  // Skip cache for streaming, tool calls, or if explicitly disabled
  const cacheable = !opts.stream && !opts.tools && opts.cache !== false;

  if (cacheable) {
    const cached = await promptCache.get(opts.namespace ?? 'default', prompt, model);
    if (cached) {
      metrics.cacheHits++;
      return cached;
    }
  }

  const response = await callProvider(prompt, model, opts);

  if (cacheable) {
    const ttl = opts.cacheTtl ?? 3600; // default 1 hour
    await promptCache.set(opts.namespace ?? 'default', prompt, model, response, ttl);
  }

  return response;
}
```

### 3. Cache namespaces and TTLs

| Use case | Namespace | TTL |
|----------|-----------|-----|
| Tool descriptions (static) | `tool-desc` | 86400 (24h) |
| Skill prompts (semi-static) | `skill-prompt` | 3600 (1h) |
| System prompt rendering | `system-prompt` | 1800 (30m) |
| User queries (dynamic) | `user-query` | 300 (5m) |

Only user queries are cached; long-form agentic reasoning chains are not cacheable
(too unique). Tool description lookups and skill prompt renders are cached aggressively.

### 4. Cache metrics

In `src/api/metrics.ts`, expose cache stats:
```
GET /api/ops/metrics/cache
Response: { hits: 847, misses: 1203, hitRate: 0.41, entries: 312 }
```

Show cache hit rate in the ops admin dashboard (a simple metric card next to token usage).

### 5. Cache invalidation

Add CLI command:
```bash
carina config cache clear                     # clear all cache
carina config cache clear --namespace tool-desc  # clear specific namespace
carina config cache stats                     # show hit rate and entry count
```

## Verification Checklist

- [ ] Send the same tool description query twice - second call returns from cache (logs "cache hit")
- [ ] Redis shows `prompt-cache:*` keys after first completion
- [ ] Cache entry expires after TTL (test with short TTL of 10s in dev)
- [ ] `GET /api/ops/metrics/cache` returns hit rate > 0 after several queries
- [ ] `carina config cache clear` removes all prompt-cache keys from Redis

## Files to Create or Modify

- CREATE `src/brain/prompt-cache.ts`
- MODIFY `src/brain/LLMRouter.ts` - add cache check/set around completions
- MODIFY `src/api/metrics.ts` - add cache stats endpoint
- MODIFY `src/cli/system.ts` - add cache subcommands to `carina config`
