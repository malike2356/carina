import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ProviderPool } from './provider-pool.js';
import type { ProviderProfile } from './provider-profile.js';

function makeProfiles(): ProviderProfile[] {
  return [
    { name: 'primary', provider: 'anthropic', model: 'claude-sonnet-4-6', priority: 0, enabled: true },
    { name: 'backup', provider: 'openai', model: 'gpt-4o-mini', priority: 1, enabled: true },
  ];
}

describe('ProviderPool', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-19T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('markFailed sets cooldownUntil to a future timestamp', () => {
    const pool = new ProviderPool(makeProfiles(), { cooldownMs: 60_000 });
    pool.markFailed('primary', { type: 'rate_limit', statusCode: 429 });

    const profile = pool.getAllProfiles().find((entry) => entry.name === 'primary');
    expect(profile?.cooldownUntil).toBeGreaterThan(Date.now());
    expect(profile?.failureCount).toBe(1);
  });

  it('getAvailableProfiles excludes profiles in cooldown', () => {
    const pool = new ProviderPool(makeProfiles(), { cooldownMs: 60_000 });
    pool.markFailed('primary', { type: 'server_error', statusCode: 503 });

    const available = pool.getAvailableProfiles();
    expect(available.map((entry) => entry.name)).toEqual(['backup']);
  });

  it('withFailover retries up to maxRetries then moves to next profile', async () => {
    const pool = new ProviderPool(makeProfiles(), { maxRetries: 2, cooldownMs: 60_000 });
    const attempts: string[] = [];

    const promise = pool.withFailover(async (profile) => {
      attempts.push(profile.name);
      if (profile.name === 'primary') {
        const err = new Error('overloaded') as Error & { status: number };
        err.status = 503;
        throw err;
      }
      return 'ok';
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok');
    expect(attempts.filter((name) => name === 'primary').length).toBe(3);
    expect(attempts.at(-1)).toBe('backup');
  });

  it('does not retry auth errors on the same profile', async () => {
    const pool = new ProviderPool(makeProfiles(), { maxRetries: 2, cooldownMs: 60_000 });
    const attempts: string[] = [];

    await expect(pool.withFailover(async (profile) => {
      attempts.push(profile.name);
      if (profile.name === 'primary') {
        const err = new Error('unauthorized') as Error & { status: number };
        err.status = 401;
        throw err;
      }
      return 'ok';
    })).resolves.toBe('ok');

    expect(attempts.filter((name) => name === 'primary').length).toBe(1);
    expect(attempts).toContain('backup');
  });

  it('uses doubled cooldown for rate limit errors', () => {
    const pool = new ProviderPool(makeProfiles(), { cooldownMs: 60_000 });
    pool.markFailed('primary', { type: 'rate_limit', statusCode: 429 });

    const profile = pool.getAllProfiles().find((entry) => entry.name === 'primary');
    expect(profile?.cooldownUntil).toBe(Date.now() + 120_000);
  });

  it('resetAllCooldowns clears failure state', () => {
    const pool = new ProviderPool(makeProfiles(), { cooldownMs: 60_000 });
    pool.markFailed('primary', { type: 'server_error', statusCode: 503 });
    pool.resetAllCooldowns();

    expect(pool.getAvailableProfiles().map((entry) => entry.name)).toEqual(['primary', 'backup']);
  });
});
