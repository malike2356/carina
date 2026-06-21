import { describe, expect, it } from 'vitest';
import { SessionWriteLock } from './session-lock.js';

describe('SessionWriteLock', () => {
  it('acquires and releases', async () => {
    const lock = new SessionWriteLock(1000);
    expect(await lock.acquire('s1', 'h1')).toBe(true);
    expect(lock.isLocked('s1')).toBe(true);
    lock.release('s1', 'h1');
    expect(lock.isLocked('s1')).toBe(false);
  });

  it('allows re-entrant acquire for same holder', async () => {
    const lock = new SessionWriteLock(1000);
    expect(await lock.acquire('s1', 'h1')).toBe(true);
    expect(await lock.acquire('s1', 'h1')).toBe(true);
  });
});
