import { describe, expect, it } from 'vitest';
import { isAdminTokenUsable } from './ensure-business-admin.js';

function makeToken(expMs: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ operatorId: 'op-1', email: 'admin@example.com', exp: expMs })).toString(
    'base64url',
  );
  return `${header}.${body}.sig`;
}

describe('isAdminTokenUsable', () => {
  it('rejects missing or malformed tokens', () => {
    expect(isAdminTokenUsable(undefined)).toBe(false);
    expect(isAdminTokenUsable('')).toBe(false);
    expect(isAdminTokenUsable('not-a-jwt')).toBe(false);
  });

  it('rejects expired tokens and tokens inside the refresh skew window', () => {
    const now = Date.UTC(2026, 6, 17, 10, 0, 0);
    expect(isAdminTokenUsable(makeToken(now - 1_000), now)).toBe(false);
    expect(isAdminTokenUsable(makeToken(now + 2 * 60 * 1000), now)).toBe(false);
  });

  it('accepts tokens with enough remaining lifetime', () => {
    const now = Date.UTC(2026, 6, 17, 10, 0, 0);
    expect(isAdminTokenUsable(makeToken(now + 30 * 60 * 1000), now)).toBe(true);
  });
});
