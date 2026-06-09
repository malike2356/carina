import { describe, expect, it } from 'vitest';
import { CredentialPool, parseKeyPool, resolveApiKey } from './credential-pool.js';

describe('credential-pool', () => {
  it('round-robins keys', () => {
    const pool = new CredentialPool(['a', 'b', 'c']);
    expect(pool.next()).toBe('a');
    expect(pool.next()).toBe('b');
    expect(pool.next()).toBe('c');
    expect(pool.next()).toBe('a');
  });

  it('parses comma-separated env pools', () => {
    const pool = parseKeyPool(' key1 , key2 ');
    expect(pool.size).toBe(2);
  });

  it('prefers pool over single key', () => {
    expect(resolveApiKey('single', 'pool1,pool2')).toBe('pool1');
    expect(resolveApiKey('', 'pool1,pool2')).toBe('pool1');
  });
});
