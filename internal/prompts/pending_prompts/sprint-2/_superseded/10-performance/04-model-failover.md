# Prompt 04: Model Failover with Circuit Breaker


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

The LLM router already has a fallback chain. But when a provider starts returning errors,
it keeps retrying each time, adding latency. A circuit breaker pattern stops sending
requests to a failing provider and routes around it automatically until it recovers.

## What to Build

### 1. Circuit breaker implementation

Create `src/brain/circuit-breaker.ts`:
```typescript
export type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: Date | null = null;
  private readonly failureThreshold: number;
  private readonly recoveryTimeMs: number;

  constructor(opts: { failureThreshold?: number; recoveryTimeMs?: number } = {}) {
    this.failureThreshold = opts.failureThreshold ?? 5; // 5 failures -> open
    this.recoveryTimeMs = opts.recoveryTimeMs ?? 30000; // 30s recovery window
  }

  canRequest(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      const msSinceFailure = this.lastFailureTime ? Date.now() - this.lastFailureTime.getTime() : Infinity;
      if (msSinceFailure >= this.recoveryTimeMs) {
        this.state = 'half-open';
        return true; // allow one test request
      }
      return false;
    }
    return true; // half-open: allow test request
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open';
    }
  }

  getStatus(): { state: CircuitState; failureCount: number; lastFailure: Date | null } {
    return { state: this.state, failureCount: this.failureCount, lastFailure: this.lastFailureTime };
  }
}
```

### 2. Per-provider circuit breakers

In `src/brain/provider-registry.ts`:
```typescript
const CIRCUIT_BREAKERS: Record<string, CircuitBreaker> = {};

export function getCircuitBreaker(provider: string): CircuitBreaker {
  if (!CIRCUIT_BREAKERS[provider]) {
    CIRCUIT_BREAKERS[provider] = new CircuitBreaker();
  }
  return CIRCUIT_BREAKERS[provider];
}

export function getAllCircuitStatuses(): Record<string, ReturnType<CircuitBreaker['getStatus']>> {
  return Object.fromEntries(
    Object.entries(CIRCUIT_BREAKERS).map(([k, v]) => [k, v.getStatus()])
  );
}
```

### 3. Integration with LLM router

In `src/brain/LLMRouter.ts`, wrap each provider call:
```typescript
for (const provider of fallbackChain) {
  const cb = getCircuitBreaker(provider);
  if (!cb.canRequest()) {
    console.log(`[circuit-open] skipping ${provider} (open circuit)`);
    continue;
  }

  try {
    const response = await callProvider(provider, prompt, opts);
    cb.recordSuccess();
    return response;
  } catch (err) {
    cb.recordFailure();
    console.error(`[provider-fail] ${provider}: ${err}`);
    continue; // try next provider
  }
}
throw new Error('All providers failed');
```

### 4. Circuit status API

```
GET /api/ops/providers/status
Response:
{
  "openai": { "state": "closed", "failureCount": 0, "lastFailure": null },
  "anthropic": { "state": "open", "failureCount": 5, "lastFailure": "2026-06-19T08:00:00Z" },
  "deepseek": { "state": "closed", "failureCount": 1, "lastFailure": "2026-06-19T07:30:00Z" }
}
```

### 5. Ops admin provider health panel

In `ops.carinaai.uk/views/dashboard.ejs`, add a provider health grid:
```
Provider Status:
  DeepSeek     [OPEN]     5 failures - recovery in 18s
  OpenAI       [CLOSED]   OK
  Anthropic    [CLOSED]   OK
  Gemini       [CLOSED]   OK
```

Red dot for open, green dot for closed, amber dot for half-open. Auto-refreshes every 10 seconds.

## Verification Checklist

- [ ] Make DeepSeek fail 5 times (use invalid key or mock) - circuit opens
- [ ] Next request routes to OpenAI instead (skips DeepSeek in log output)
- [ ] After 30 seconds, circuit goes half-open - one test request to DeepSeek
- [ ] Test request succeeds - circuit closes, DeepSeek back in rotation
- [ ] Ops dashboard provider health grid shows OPEN state for failing provider

## Files to Create or Modify

- CREATE `src/brain/circuit-breaker.ts`
- MODIFY `src/brain/provider-registry.ts` - add circuit breaker per provider
- MODIFY `src/brain/LLMRouter.ts` - check circuit before each provider call
- MODIFY `src/api/metrics.ts` - add provider status endpoint
- MODIFY `ops.carinaai.uk/views/dashboard.ejs` - add provider health panel
