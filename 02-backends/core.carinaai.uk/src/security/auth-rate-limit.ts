import { getRedis } from '../memory/redis.js';

export type AuthRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number; reason: string };

type Bucket = {
  failures: number;
  windowStart: number;
  lockedUntil?: number;
};

const buckets = new Map<string, Bucket>();

function maxFailures(): number {
  const raw = process.env.CARINA_AUTH_RATE_LIMIT_MAX ?? '5';
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5;
}

function windowMs(): number {
  const raw = process.env.CARINA_AUTH_RATE_LIMIT_WINDOW_MS ?? String(15 * 60 * 1000);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 15 * 60 * 1000;
}

function lockoutMs(): number {
  // Default matches the "locked for 15 minutes after 5 failed logins" hardening target.
  const raw = process.env.CARINA_AUTH_LOCKOUT_MS ?? String(15 * 60 * 1000);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 15 * 60 * 1000;
}

function bucketKey(scope: string, key: string): string {
  return `${scope}:${key.trim().toLowerCase()}`;
}

function now(): number {
  return Date.now();
}

export function authRateLimitEnabled(): boolean {
  return process.env.CARINA_AUTH_RATE_LIMIT === 'off' ? false : true;
}

function checkMemory(id: string): AuthRateLimitResult {
  const bucket = buckets.get(id);
  const t = now();

  if (bucket?.lockedUntil && bucket.lockedUntil > t) {
    return {
      allowed: false,
      retryAfterMs: bucket.lockedUntil - t,
      reason: 'too many failed authentication attempts',
    };
  }

  if (bucket && t - bucket.windowStart > windowMs()) {
    buckets.delete(id);
  }

  return { allowed: true };
}

function recordFailureMemory(id: string): AuthRateLimitResult {
  const t = now();
  let bucket = buckets.get(id);

  if (!bucket || t - bucket.windowStart > windowMs()) {
    bucket = { failures: 0, windowStart: t };
  }

  bucket.failures += 1;
  if (bucket.failures >= maxFailures()) {
    bucket.lockedUntil = t + lockoutMs();
  }
  buckets.set(id, bucket);

  if (bucket.lockedUntil && bucket.lockedUntil > t) {
    return {
      allowed: false,
      retryAfterMs: bucket.lockedUntil - t,
      reason: 'too many failed authentication attempts',
    };
  }

  return { allowed: true };
}

/**
 * Checks whether `scope`/`key` (typically an email or "email:ip" pair) is
 * currently locked out. Uses Redis when connected so the lockout is shared
 * across all app instances; falls back to a local in-memory bucket
 * otherwise (single-instance dev/test behavior, same as before).
 */
export async function checkAuthRateLimit(scope: string, key: string): Promise<AuthRateLimitResult> {
  if (!authRateLimitEnabled()) return { allowed: true };
  if (!key.trim()) return { allowed: true };

  const id = bucketKey(scope, key);
  const redis = getRedis();
  if (redis) {
    try {
      const ttl = await redis.pttl(`carina:auth:lock:${id}`);
      if (ttl > 0) {
        return {
          allowed: false,
          retryAfterMs: ttl,
          reason: 'too many failed authentication attempts',
        };
      }
      return { allowed: true };
    } catch {
      // fall through to memory
    }
  }
  return checkMemory(id);
}

/** Records a failed authentication attempt; returns the resulting lock state. */
export async function recordAuthFailure(scope: string, key: string): Promise<AuthRateLimitResult> {
  if (!authRateLimitEnabled()) return { allowed: true };
  if (!key.trim()) return { allowed: true };

  const id = bucketKey(scope, key);
  const redis = getRedis();
  if (redis) {
    try {
      const failKey = `carina:auth:fail:${id}`;
      const lockKey = `carina:auth:lock:${id}`;
      const count = await redis.incr(failKey);
      if (count === 1) {
        await redis.pexpire(failKey, windowMs());
      }
      if (count >= maxFailures()) {
        await redis.set(lockKey, '1', 'PX', lockoutMs());
        return {
          allowed: false,
          retryAfterMs: lockoutMs(),
          reason: 'too many failed authentication attempts',
        };
      }
      return { allowed: true };
    } catch {
      // fall through to memory
    }
  }
  return recordFailureMemory(id);
}

/** Clears failures/lockout after a successful authentication. */
export async function clearAuthFailures(scope: string, key: string): Promise<void> {
  const id = bucketKey(scope, key);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`carina:auth:fail:${id}`, `carina:auth:lock:${id}`);
      return;
    } catch {
      // fall through to memory
    }
  }
  buckets.delete(id);
}

/** Reset in-memory buckets (tests only). */
export function _resetAuthRateLimitsForTests(): void {
  buckets.clear();
}
