# Gap 09 - Prompt 08: Model Failover and Auth Profile Rotation

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 3-4 hrs
**Depends on:** `src/providers/` exists

---

## The Problem

If Anthropic returns a 429 (rate limit), 503 (overloaded), or 401 (invalid key), Carina
currently throws an error and stops. OpenClaw handles this with auth profile rotation: it
maintains a pool of provider configs (including different API keys or providers), and when
one fails, it automatically tries the next one.

This is critical for always-on use cases like cron jobs, mobile use, and production deployments
where downtime is unacceptable.

---

## Read First

```
core.carinaai.uk/src/providers/external-cli.ts      (provider adapter - likely main one)
core.carinaai.uk/src/brain/llm.ts                   (where API calls are made)
core.carinaai.uk/src/config/session-config.ts       (config structure)
core.carinaai.uk/src/credentials/                   (credentials management)
core.carinaai.uk/src/lib/chat-errors.ts             (error types - from app.carinaai.uk)
```

---

## 1. Provider Profile Schema

```typescript
// src/providers/provider-profile.ts  (new file)

export interface ProviderProfile {
  /** Unique name for this profile */
  name: string;

  /** Provider type */
  provider: 'anthropic' | 'openai' | 'groq' | 'openrouter' | 'gemini' | string;

  /** API key (from env var or direct) */
  apiKey?: string;

  /** Base URL override */
  baseUrl?: string;

  /** Default model for this profile */
  model: string;

  /** Priority: lower = tried first. Default: 0. */
  priority?: number;

  /** Whether this profile is currently active */
  enabled?: boolean;

  /** Failure tracking */
  failureCount?: number;
  lastFailureAt?: number;
  cooldownUntil?: number; // timestamp: don't try until after this
}

export interface FailoverConfig {
  /** Max retries before moving to next profile. Default: 2. */
  maxRetries?: number;

  /** Cooldown in ms after a failure before retrying the same profile. Default: 60000 (1 min). */
  cooldownMs?: number;

  /** If true: after all profiles fail, throw. If false: wait and retry. Default: true. */
  failFast?: boolean;
}
```

---

## 2. Provider Pool Manager

```typescript
// src/providers/provider-pool.ts  (new file)

import type { ProviderProfile, FailoverConfig } from './provider-profile.js';
import { getConfig } from '../config/index.js';

const DEFAULT_FAILOVER: FailoverConfig = {
  maxRetries: 2,
  cooldownMs: 60_000,
  failFast: true,
};

class ProviderPool {
  private profiles: ProviderProfile[];
  private failoverConfig: FailoverConfig;

  constructor(profiles: ProviderProfile[], config: FailoverConfig = DEFAULT_FAILOVER) {
    this.profiles = [...profiles].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    this.failoverConfig = { ...DEFAULT_FAILOVER, ...config };
  }

  /**
   * Get available profiles (not in cooldown, enabled).
   */
  getAvailableProfiles(): ProviderProfile[] {
    const now = Date.now();
    return this.profiles.filter(p =>
      p.enabled !== false &&
      (!p.cooldownUntil || p.cooldownUntil < now)
    );
  }

  /**
   * Mark a profile as failed. Put it in cooldown.
   */
  markFailed(profileName: string, error: ProviderError): void {
    const profile = this.profiles.find(p => p.name === profileName);
    if (!profile) return;

    profile.failureCount = (profile.failureCount ?? 0) + 1;
    profile.lastFailureAt = Date.now();

    // For rate limits: use a longer cooldown
    const cooldown = error.statusCode === 429
      ? Math.min((this.failoverConfig.cooldownMs ?? 60_000) * 2, 300_000)
      : (this.failoverConfig.cooldownMs ?? 60_000);

    profile.cooldownUntil = Date.now() + cooldown;
    console.warn(
      `[failover] Profile "${profileName}" failed (${error.statusCode ?? error.type}). ` +
      `In cooldown for ${cooldown / 1000}s.`
    );
  }

  /**
   * Mark a profile as succeeded. Reset failure count.
   */
  markSucceeded(profileName: string): void {
    const profile = this.profiles.find(p => p.name === profileName);
    if (!profile) return;
    profile.failureCount = 0;
    profile.cooldownUntil = undefined;
  }

  /**
   * Execute a function with automatic failover across profiles.
   */
  async withFailover<T>(
    fn: (profile: ProviderProfile) => Promise<T>
  ): Promise<T> {
    const available = this.getAvailableProfiles();

    if (available.length === 0) {
      throw new Error('All provider profiles are in cooldown or disabled. Check your API keys.');
    }

    let lastError: Error | null = null;

    for (const profile of available) {
      let retries = 0;
      while (retries <= (this.failoverConfig.maxRetries ?? 2)) {
        try {
          const result = await fn(profile);
          this.markSucceeded(profile.name);
          return result;
        } catch (err: any) {
          const providerError = classifyError(err);

          if (!isRetryable(providerError)) {
            // Not retryable (e.g. invalid request): fail immediately
            throw err;
          }

          retries++;
          if (retries > (this.failoverConfig.maxRetries ?? 2)) {
            this.markFailed(profile.name, providerError);
            lastError = err;
            break; // Try next profile
          }

          // Wait briefly before retry
          await delay(500 * retries);
        }
      }
    }

    throw lastError ?? new Error('All provider profiles failed');
  }
}

// Singleton pool
let pool: ProviderPool | null = null;

export function getProviderPool(): ProviderPool {
  if (!pool) {
    const config = getConfig();
    const profiles: ProviderProfile[] = [
      // Primary profile from main config
      {
        name: 'primary',
        provider: config.provider ?? 'anthropic',
        apiKey: config.apiKey,
        model: config.model,
        priority: 0,
        enabled: true,
      },
      // Additional profiles from config.providerProfiles
      ...(config.providerProfiles ?? []),
    ];
    pool = new ProviderPool(profiles, config.failover);
  }
  return pool;
}

// Types for error classification
interface ProviderError {
  type: 'rate_limit' | 'auth' | 'server_error' | 'network' | 'invalid_request' | 'unknown';
  statusCode?: number;
}

function classifyError(err: any): ProviderError {
  const status = err.status ?? err.statusCode ?? err.response?.status;
  if (status === 429) return { type: 'rate_limit', statusCode: 429 };
  if (status === 401 || status === 403) return { type: 'auth', statusCode: status };
  if (status >= 500) return { type: 'server_error', statusCode: status };
  if (status === 400 || status === 422) return { type: 'invalid_request', statusCode: status };
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') return { type: 'network' };
  return { type: 'unknown' };
}

function isRetryable(error: ProviderError): boolean {
  return error.type !== 'invalid_request' && error.type !== 'auth';
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 3. Wire Into LLM Calls

```typescript
// src/brain/llm.ts  (modify the main call function)

import { getProviderPool } from '../providers/provider-pool.js';

export async function callLLM(params: LLMCallParams): Promise<LLMResponse> {
  const pool = getProviderPool();

  return pool.withFailover(async (profile) => {
    // Merge profile into params
    const resolved = {
      ...params,
      provider: profile.provider,
      model: params.model ?? profile.model,
      apiKey: profile.apiKey,
      baseUrl: profile.baseUrl,
    };

    return callProviderDirectly(resolved);
  });
}
```

---

## 4. Config Schema

```typescript
// src/config/config-schema.ts  (additions)

providerProfiles: z.array(z.object({
  name: z.string(),
  provider: z.string(),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  model: z.string(),
  priority: z.number().optional(),
  enabled: z.boolean().optional(),
})).optional(),

failover: z.object({
  maxRetries: z.number().optional(),
  cooldownMs: z.number().optional(),
  failFast: z.boolean().optional(),
}).optional(),
```

Example multi-profile config (`~/.carina/config.json`):

```json
{
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "apiKey": "sk-ant-primary-key",
  "providerProfiles": [
    {
      "name": "anthropic-backup",
      "provider": "anthropic",
      "apiKey": "sk-ant-backup-key",
      "model": "claude-sonnet-4-6",
      "priority": 1
    },
    {
      "name": "openai-fallback",
      "provider": "openai",
      "apiKey": "sk-openai-key",
      "model": "gpt-4o-mini",
      "priority": 2
    }
  ],
  "failover": {
    "maxRetries": 2,
    "cooldownMs": 60000
  }
}
```

---

## 5. CLI Status Command

```typescript
// src/cli/commands/provider-commands.ts  (additions)

registry.register({
  name: 'provider status',
  description: 'Show provider pool status and failover state',
  handler: async () => {
    const pool = getProviderPool();
    const profiles = pool.getAvailableProfiles();
    const all = getAllProfiles(); // internal method
    return all.map(p => {
      const inCooldown = p.cooldownUntil && p.cooldownUntil > Date.now();
      const status = inCooldown ? `cooldown (${Math.ceil((p.cooldownUntil! - Date.now()) / 1000)}s)`
        : p.enabled === false ? 'disabled'
        : 'available';
      return `${p.name.padEnd(20)} ${p.provider}/${p.model}  ${status}`;
    }).join('\n');
  },
});

registry.register({
  name: 'provider reset',
  description: 'Clear all provider cooldowns (useful after fixing an API key)',
  handler: async () => {
    resetAllCooldowns();
    return 'All provider cooldowns cleared.';
  },
});
```

---

## Files to Create

```
core.carinaai.uk/src/providers/provider-profile.ts
core.carinaai.uk/src/providers/provider-pool.ts
```

## Files to Modify

```
core.carinaai.uk/src/brain/llm.ts               use pool.withFailover() for all LLM calls
core.carinaai.uk/src/config/config-schema.ts    add providerProfiles + failover schemas
core.carinaai.uk/src/cli/commands/provider-commands.ts  add status + reset commands
```

---

## Done When

- [ ] Primary profile fails (mock 429): secondary profile is tried automatically
- [ ] Failed profile goes into 60-second cooldown before being tried again
- [ ] Auth errors (401) are NOT retried (not retryable)
- [ ] Rate limit errors (429) get 2x cooldown duration
- [ ] After all profiles fail, a clear error is thrown
- [ ] `carina provider status` shows all profiles with cooldown countdown
- [ ] `carina provider reset` clears all cooldowns
- [ ] Single-profile config (no providerProfiles) works identically to before
- [ ] Unit test: markFailed sets cooldownUntil to future timestamp
- [ ] Unit test: getAvailableProfiles excludes profiles in cooldown
- [ ] Unit test: withFailover retries up to maxRetries then moves to next profile