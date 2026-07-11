import { describe, expect, it } from 'vitest';
import { SESSION_EXPIRED_MESSAGE, sessionExpiredBanner } from './auth-messages';

describe('auth-messages', () => {
  it('returns session expired copy when flagged', () => {
    expect(sessionExpiredBanner(true)).toBe(SESSION_EXPIRED_MESSAGE);
    expect(sessionExpiredBanner(false)).toBeNull();
  });
});
