import { describe, it, expect, vi, afterEach } from 'vitest';
import { TokenBucket } from '../token-bucket.js';

describe('TokenBucket', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('honors capacity and refills over time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));

    const bucket = new TokenBucket(2, 1);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);

    vi.setSystemTime(new Date('2026-01-01T00:00:01Z'));
    expect(bucket.consume()).toBe(true);
  });

  it('round-trips from snapshots', () => {
    const bucket = new TokenBucket(1, 1);
    expect(bucket.consume()).toBe(true);
    const restored = TokenBucket.fromSnapshot(bucket.toSnapshot());
    expect(restored.consume()).toBe(false);
  });
});
