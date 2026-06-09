import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveExternalId } from './hosted-chat.js';

vi.mock('../api/hosted.js', () => ({
  checkHostedQuota: vi.fn(),
}));

describe('hosted-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses server-trusted hosted user id for session key', () => {
    const req = {
      hostedUser: { id: 'user-abc', email: 'a@b.com', tier: 'free' },
      body: { sessionId: 'attacker-session' },
      query: {},
    } as Parameters<typeof resolveExternalId>[0];
    expect(resolveExternalId(req)).toBe('hosted:user-abc');
  });

  it('falls back to client session id for operator path', () => {
    const req = {
      body: { sessionId: 'tab-1' },
      query: {},
    } as Parameters<typeof resolveExternalId>[0];
    expect(resolveExternalId(req)).toBe('tab-1');
  });

  it('uses query session id when body is empty', () => {
    const req = {
      body: {},
      query: { sessionId: 'stream-tab' },
    } as Parameters<typeof resolveExternalId>[0];
    expect(resolveExternalId(req)).toBe('stream-tab');
  });
});
