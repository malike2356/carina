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
  const raw = process.env.CARINA_AUTH_LOCKOUT_MS ?? String(5 * 60 * 1000);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 5 * 60 * 1000;
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

export function checkAuthRateLimit(scope: string, key: string): AuthRateLimitResult {
  if (!authRateLimitEnabled()) return { allowed: true };
  if (!key.trim()) return { allowed: true };

  const id = bucketKey(scope, key);
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

export function recordAuthFailure(scope: string, key: string): AuthRateLimitResult {
  if (!authRateLimitEnabled()) return { allowed: true };
  if (!key.trim()) return { allowed: true };

  const id = bucketKey(scope, key);
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

export function clearAuthFailures(scope: string, key: string): void {
  buckets.delete(bucketKey(scope, key));
}

/** Reset in-memory buckets (tests only). */
export function _resetAuthRateLimitsForTests(): void {
  buckets.clear();
}
