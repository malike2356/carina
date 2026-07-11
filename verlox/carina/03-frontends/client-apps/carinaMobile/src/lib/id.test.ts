import { describe, expect, it } from 'vitest';
import { buildHostedExternalId, generateSessionId, isUuid } from './id';

describe('generateSessionId', () => {
  it('returns a uuid suitable for cloud chat_sessions', () => {
    const id = generateSessionId();
    expect(isUuid(id)).toBe(true);
    expect(id).not.toBe('default');
  });

  it('generates unique ids', () => {
    const a = generateSessionId();
    const b = generateSessionId();
    expect(a).not.toBe(b);
  });
});

describe('buildHostedExternalId', () => {
  it('matches core hosted external id shape', () => {
    expect(buildHostedExternalId('user-abc', 'mobile-xyz')).toBe(
      'hosted:user-abc:mobile-xyz',
    );
  });

  it('isolates threads for the same hosted user', () => {
    const userId = 'user-abc';
    const a = buildHostedExternalId(userId, 'thread-a');
    const b = buildHostedExternalId(userId, 'thread-b');
    expect(a).not.toBe(b);
  });

  it('falls back to default when client session id is blank', () => {
    expect(buildHostedExternalId('user-abc', '   ')).toBe('hosted:user-abc:default');
  });
});
