import { afterEach, describe, expect, it } from 'vitest';
import {
  _resetAuthRateLimitsForTests,
  authRateLimitEnabled,
  checkAuthRateLimit,
  clearAuthFailures,
  recordAuthFailure,
} from './auth-rate-limit.js';

// Focused coverage for the "brute force lockout after 5 fails / 15 min"
// hardening requirement, on top of the existing basic coverage in
// security-guardrails.test.ts. Runs against the in-memory fallback path
// since Redis is not connected in the unit test environment.

describe('auth-rate-limit: brute force lockout defaults', () => {
  afterEach(() => {
    _resetAuthRateLimitsForTests();
    delete process.env.CARINA_AUTH_RATE_LIMIT_MAX;
    delete process.env.CARINA_AUTH_LOCKOUT_MS;
    delete process.env.CARINA_AUTH_RATE_LIMIT;
  });

  it('is enabled by default', () => {
    expect(authRateLimitEnabled()).toBe(true);
  });

  it('allows the first 4 failures, then locks out on the 5th', async () => {
    const key = `bf-test-${Math.random()}@example.com`;
    for (let i = 0; i < 4; i++) {
      const result = await recordAuthFailure('login', key);
      expect(result.allowed).toBe(true);
    }
    const fifth = await recordAuthFailure('login', key);
    expect(fifth.allowed).toBe(false);
  });

  it('reports a ~15 minute retry-after on lockout by default', async () => {
    const key = `bf-lockout-${Math.random()}@example.com`;
    for (let i = 0; i < 4; i++) {
      await recordAuthFailure('login', key);
    }
    const locked = await recordAuthFailure('login', key);
    expect(locked.allowed).toBe(false);
    if (!locked.allowed) {
      const fifteenMinutesMs = 15 * 60 * 1000;
      expect(locked.retryAfterMs).toBeGreaterThan(fifteenMinutesMs - 1000);
      expect(locked.retryAfterMs).toBeLessThanOrEqual(fifteenMinutesMs);
    }
  });

  it('stays locked out on subsequent checks until cleared', async () => {
    const key = `bf-stay-locked-${Math.random()}@example.com`;
    for (let i = 0; i < 5; i++) {
      await recordAuthFailure('login', key);
    }
    expect((await checkAuthRateLimit('login', key)).allowed).toBe(false);
    await clearAuthFailures('login', key);
    expect((await checkAuthRateLimit('login', key)).allowed).toBe(true);
  });

  it('scopes lockouts independently per scope key', async () => {
    const email = `bf-scope-${Math.random()}@example.com`;
    for (let i = 0; i < 5; i++) {
      await recordAuthFailure('login', email);
    }
    expect((await checkAuthRateLimit('login', email)).allowed).toBe(false);
    expect((await checkAuthRateLimit('signup', email)).allowed).toBe(true);
  });

  it('is a no-op when CARINA_AUTH_RATE_LIMIT=off', async () => {
    process.env.CARINA_AUTH_RATE_LIMIT = 'off';
    const key = `bf-off-${Math.random()}@example.com`;
    for (let i = 0; i < 10; i++) {
      const result = await recordAuthFailure('login', key);
      expect(result.allowed).toBe(true);
    }
  });
});
