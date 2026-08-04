/**
 * Redis-backed fixed-window rate limiter for the five hardening scopes:
 * login, signup, ai_api, api, webhook. Falls back to an in-memory window
 * when Redis is unavailable (local dev, tests) so limiting still works on
 * a single process, matching the degrade-gracefully pattern used by
 * tool-policy-middleware.ts and hosted/scoped-query.ts elsewhere in this
 * codebase.
 *
 * This is a separate concern from auth-rate-limit.ts, which implements
 * brute-force lockout (failure counting) for authentication attempts.
 * This module implements request-volume throttling (how many requests of
 * a given kind may pass in a time window), independent of success/failure.
 */
import type { NextFunction, Request, Response } from 'express';
import { getRedis } from '../memory/redis.js';

export type RateLimitScope = 'login' | 'signup' | 'ai_api' | 'api' | 'webhook';

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

const DEFAULT_LIMITS: Record<RateLimitScope, RateLimitConfig> = {
  login: { max: 5, windowMs: 60_000 },
  signup: { max: 3, windowMs: 60 * 60_000 },
  ai_api: { max: 30, windowMs: 60_000 },
  api: { max: 100, windowMs: 60_000 },
  webhook: { max: 60, windowMs: 60_000 },
};

const ENV_OVERRIDES: Record<RateLimitScope, { max: string; windowMs: string }> = {
  login: { max: 'CARINA_RATE_LIMIT_LOGIN_MAX', windowMs: 'CARINA_RATE_LIMIT_LOGIN_WINDOW_MS' },
  signup: { max: 'CARINA_RATE_LIMIT_SIGNUP_MAX', windowMs: 'CARINA_RATE_LIMIT_SIGNUP_WINDOW_MS' },
  ai_api: { max: 'CARINA_RATE_LIMIT_AI_API_MAX', windowMs: 'CARINA_RATE_LIMIT_AI_API_WINDOW_MS' },
  api: { max: 'CARINA_RATE_LIMIT_API_MAX', windowMs: 'CARINA_RATE_LIMIT_API_WINDOW_MS' },
  webhook: { max: 'CARINA_RATE_LIMIT_WEBHOOK_MAX', windowMs: 'CARINA_RATE_LIMIT_WEBHOOK_WINDOW_MS' },
};

function positiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function resolveRateLimitConfig(scope: RateLimitScope): RateLimitConfig {
  const defaults = DEFAULT_LIMITS[scope];
  const envKeys = ENV_OVERRIDES[scope];
  return {
    max: positiveInt(process.env[envKeys.max], defaults.max),
    windowMs: positiveInt(process.env[envKeys.windowMs], defaults.windowMs),
  };
}

export function rateLimitEnabled(): boolean {
  return process.env.CARINA_RATE_LIMIT !== 'off';
}

type MemoryWindow = { count: number; windowStart: number };
const memoryWindows = new Map<string, MemoryWindow>();

function checkMemory(key: string, cfg: RateLimitConfig): RateLimitDecision {
  const now = Date.now();
  const existing = memoryWindows.get(key);
  if (!existing || now - existing.windowStart >= cfg.windowMs) {
    memoryWindows.set(key, { count: 1, windowStart: now });
    return { allowed: true, limit: cfg.max, remaining: cfg.max - 1, retryAfterSeconds: 0 };
  }
  if (existing.count >= cfg.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((existing.windowStart + cfg.windowMs - now) / 1000));
    return { allowed: false, limit: cfg.max, remaining: 0, retryAfterSeconds };
  }
  existing.count += 1;
  return { allowed: true, limit: cfg.max, remaining: cfg.max - existing.count, retryAfterSeconds: 0 };
}

async function checkRedis(key: string, cfg: RateLimitConfig): Promise<RateLimitDecision | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const results = await redis
      .multi()
      .incr(key)
      .pttl(key)
      .exec();
    if (!results) return null;
    const [incrErr, countRaw] = results[0] ?? [null, 0];
    const [ttlErr, ttlRaw] = results[1] ?? [null, -1];
    if (incrErr || ttlErr) return null;
    const count = Number(countRaw);
    let ttlMs = Number(ttlRaw);
    if (ttlMs < 0) {
      await redis.pexpire(key, cfg.windowMs);
      ttlMs = cfg.windowMs;
    }
    if (count > cfg.max) {
      return {
        allowed: false,
        limit: cfg.max,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
      };
    }
    return {
      allowed: true,
      limit: cfg.max,
      remaining: Math.max(0, cfg.max - count),
      retryAfterSeconds: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Check (and consume) one unit of the rate limit budget for `scope`/`key`.
 * Uses Redis when connected (multi-instance safe); otherwise degrades to a
 * single-process in-memory window.
 */
export async function checkRateLimit(
  scope: RateLimitScope,
  key: string,
  overrides?: Partial<RateLimitConfig>,
): Promise<RateLimitDecision> {
  if (!rateLimitEnabled() || !key.trim()) {
    return { allowed: true, limit: 0, remaining: 0, retryAfterSeconds: 0 };
  }
  const cfg = { ...resolveRateLimitConfig(scope), ...overrides };
  const redisKey = `carina:ratelimit:${scope}:${key}`;
  const viaRedis = await checkRedis(redisKey, cfg);
  if (viaRedis) return viaRedis;
  return checkMemory(redisKey, cfg);
}

function defaultKeyFn(req: Request): string {
  const header = req.headers['x-workspace-id'];
  const workspaceId = Array.isArray(header) ? header[0] : header;
  const carinaUser = (req as Request & { carinaUser?: { id?: string } }).carinaUser;
  const hostedAccountId = (req as Request & { session?: { hostedAccountId?: string } }).session?.hostedAccountId;
  const userId = carinaUser?.id ?? hostedAccountId ?? workspaceId;
  if (userId) return `user:${userId}`;
  return `ip:${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}`;
}

/**
 * Express middleware factory. Responds 429 with a Retry-After header and a
 * JSON body describing the limit when the scope's budget is exhausted.
 */
export function rateLimitMiddleware(
  scope: RateLimitScope,
  options: { keyFn?: (req: Request) => string; skip?: (req: Request) => boolean } = {},
) {
  const keyFn = options.keyFn ?? defaultKeyFn;
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (options.skip?.(req)) {
      next();
      return;
    }
    const decision = await checkRateLimit(scope, keyFn(req));
    if (!decision.allowed) {
      res.setHeader('Retry-After', String(decision.retryAfterSeconds));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        scope,
        retry_after_seconds: decision.retryAfterSeconds,
        message: `Too many requests. Try again in ${decision.retryAfterSeconds}s.`,
      });
      return;
    }
    res.setHeader('X-RateLimit-Limit', String(decision.limit));
    res.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    next();
  };
}

/** Reset in-memory windows (tests only; Redis-backed windows expire naturally). */
export function _resetRateLimitsForTests(): void {
  memoryWindows.clear();
}
