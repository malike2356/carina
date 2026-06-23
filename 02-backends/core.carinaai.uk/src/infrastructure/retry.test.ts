import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  RetryError,
  computeBackoffDelay,
  parseRetryAfterMs,
  retryAsync,
} from './retry.js';
import {
  CHANNEL_API_RETRY_RE,
  httpRetryError,
  httpStatusShouldRetry,
  shouldRetryHttpError,
} from './retry-policy.js';

describe('retry infrastructure', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseRetryAfterMs accepts seconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
  });

  it('parseRetryAfterMs accepts HTTP-date', () => {
    const future = new Date(Date.now() + 5000).toUTCString();
    const ms = parseRetryAfterMs(future);
    expect(ms).toBeGreaterThan(4000);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('computeBackoffDelay grows with attempt', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const a1 = computeBackoffDelay(1, { minDelayMs: 400, maxDelayMs: 30_000, jitter: 0 });
    const a2 = computeBackoffDelay(2, { minDelayMs: 400, maxDelayMs: 30_000, jitter: 0 });
    expect(a2).toBeGreaterThan(a1);
  });

  it('retryAsync succeeds on second attempt', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    const result = await retryAsync(
      async () => {
        calls += 1;
        if (calls < 2) throw new Error('timeout connecting');
        return 'ok';
      },
      {
        attempts: 2,
        minDelayMs: 10,
        maxDelayMs: 20,
        jitter: 0,
        sleep,
        shouldRetry: shouldRetryHttpError,
      },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
    expect(sleep).toHaveBeenCalledOnce();
  });

  it('retryAsync respects Retry-After from http error', async () => {
    const sleep = vi.fn(async () => {});
    let calls = 0;
    await retryAsync(
      async () => {
        calls += 1;
        if (calls < 2) {
          throw httpRetryError({ status: 429, message: 'rate limited', retryAfterHeader: '1' });
        }
        return true;
      },
      {
        attempts: 2,
        minDelayMs: 400,
        maxDelayMs: 30_000,
        jitter: 0,
        sleep,
        shouldRetry: shouldRetryHttpError,
        retryAfterMs: (err) => (err as { retryAfterMs?: number }).retryAfterMs,
      },
    );
    expect(sleep).toHaveBeenCalledWith(1000);
  });

  it('retryAsync throws RetryError when exhausted', async () => {
    await expect(
      retryAsync(async () => {
        throw new Error('closed connection');
      }, {
        attempts: 2,
        minDelayMs: 0,
        maxDelayMs: 0,
        jitter: 0,
        sleep: async () => {},
        shouldRetry: shouldRetryHttpError,
      }),
    ).rejects.toBeInstanceOf(RetryError);
  });

  it('httpStatusShouldRetry covers rate limit and 5xx', () => {
    expect(httpStatusShouldRetry(429)).toBe(true);
    expect(httpStatusShouldRetry(503)).toBe(true);
    expect(httpStatusShouldRetry(404)).toBe(false);
  });

  it('CHANNEL_API_RETRY_RE matches common transient errors', () => {
    expect(CHANNEL_API_RETRY_RE.test('connect ECONNRESET')).toBe(true);
    expect(CHANNEL_API_RETRY_RE.test('validation failed')).toBe(false);
  });
});
