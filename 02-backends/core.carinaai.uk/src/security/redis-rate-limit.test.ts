import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  _resetRateLimitsForTests,
  checkRateLimit,
  rateLimitMiddleware,
  resolveRateLimitConfig,
} from './redis-rate-limit.js';

// This suite exercises the in-memory fallback path (no Redis configured in
// the test environment, matching src/memory/redis.ts's getRedis() === null
// when initRedis() has not connected). Redis-backed behavior is covered by
// checkRedis's own fallback-to-memory-on-error branch, which this suite
// also implicitly relies on since ioredis is not connected in tests.

describe('redis-rate-limit config', () => {
  afterEach(() => {
    delete process.env.CARINA_RATE_LIMIT_LOGIN_MAX;
    delete process.env.CARINA_RATE_LIMIT_LOGIN_WINDOW_MS;
  });

  it('has sane scope defaults', () => {
    expect(resolveRateLimitConfig('login')).toEqual({ max: 5, windowMs: 60_000 });
    expect(resolveRateLimitConfig('signup')).toEqual({ max: 3, windowMs: 3_600_000 });
    expect(resolveRateLimitConfig('ai_api')).toEqual({ max: 30, windowMs: 60_000 });
    expect(resolveRateLimitConfig('api')).toEqual({ max: 100, windowMs: 60_000 });
    expect(resolveRateLimitConfig('webhook')).toEqual({ max: 60, windowMs: 60_000 });
  });

  it('honors environment variable overrides', () => {
    process.env.CARINA_RATE_LIMIT_LOGIN_MAX = '2';
    process.env.CARINA_RATE_LIMIT_LOGIN_WINDOW_MS = '5000';
    expect(resolveRateLimitConfig('login')).toEqual({ max: 2, windowMs: 5000 });
  });
});

describe('checkRateLimit (in-memory fallback)', () => {
  afterEach(() => {
    _resetRateLimitsForTests();
    delete process.env.CARINA_RATE_LIMIT;
  });

  it('allows requests under the limit and decrements remaining', async () => {
    const key = `test-key-${Math.random()}`;
    const first = await checkRateLimit('login', key, { max: 3, windowMs: 60_000 });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);

    const second = await checkRateLimit('login', key, { max: 3, windowMs: 60_000 });
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);
  });

  it('blocks once the budget is exhausted and reports retryAfterSeconds', async () => {
    const key = `test-key-${Math.random()}`;
    const cfg = { max: 2, windowMs: 60_000 };
    await checkRateLimit('login', key, cfg);
    await checkRateLimit('login', key, cfg);
    const blocked = await checkRateLimit('login', key, cfg);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('resets after the window elapses', async () => {
    const key = `test-key-${Math.random()}`;
    const cfg = { max: 1, windowMs: 10 };
    await checkRateLimit('login', key, cfg);
    const blocked = await checkRateLimit('login', key, cfg);
    expect(blocked.allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 20));
    const afterWindow = await checkRateLimit('login', key, cfg);
    expect(afterWindow.allowed).toBe(true);
  });

  it('bypasses limiting entirely when CARINA_RATE_LIMIT=off', async () => {
    process.env.CARINA_RATE_LIMIT = 'off';
    const key = `test-key-${Math.random()}`;
    const cfg = { max: 1, windowMs: 60_000 };
    await checkRateLimit('login', key, cfg);
    const stillAllowed = await checkRateLimit('login', key, cfg);
    expect(stillAllowed.allowed).toBe(true);
  });
});

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response & { statusCode?: number; body?: unknown; headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  const res = {
    headers,
    statusCode: undefined,
    body: undefined,
    setHeader(name: string, value: string) {
      headers[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res as unknown as Response & { statusCode?: number; body?: unknown; headers: Record<string, string> };
}

describe('rateLimitMiddleware', () => {
  afterEach(() => {
    _resetRateLimitsForTests();
  });

  it('calls next() and sets rate-limit headers when under budget', async () => {
    process.env.CARINA_RATE_LIMIT_API_MAX = '5';
    const middleware = rateLimitMiddleware('api', { keyFn: () => `mw-test-${Math.random()}` });
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers['X-RateLimit-Limit']).toBeDefined();
    delete process.env.CARINA_RATE_LIMIT_API_MAX;
  });

  it('responds 429 with Retry-After when the budget is exhausted', async () => {
    const key = `mw-blocked-${Math.random()}`;
    const middleware = rateLimitMiddleware('login', { keyFn: () => key });
    const cfg = resolveRateLimitConfig('login');

    for (let i = 0; i < cfg.max; i++) {
      await middleware(mockReq(), mockRes(), vi.fn());
    }

    const res = mockRes();
    const next = vi.fn();
    await middleware(mockReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
    expect((res.body as { error: string }).error).toBe('rate_limit_exceeded');
  });

  it('skips rate limiting when skip() returns true', async () => {
    const middleware = rateLimitMiddleware('login', {
      keyFn: () => `skip-test-${Math.random()}`,
      skip: () => true,
    });
    const next = vi.fn();
    await middleware(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledOnce();
  });
});
