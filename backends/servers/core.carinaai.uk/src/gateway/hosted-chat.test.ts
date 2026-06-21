import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveClientSessionId, resolveExternalId } from './hosted-chat.js';

vi.mock('../api/hosted.js', () => ({
  checkHostedQuota: vi.fn(),
}));

describe('hosted-chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes hosted sessions per user and client thread id', () => {
    const req = {
      hostedUser: { id: 'user-abc', email: 'a@b.com', tier: 'free' },
      body: { sessionId: 'thread-a' },
      query: {},
    } as Parameters<typeof resolveExternalId>[0];
    expect(resolveExternalId(req)).toBe('hosted:user-abc:thread-a');
    expect(resolveClientSessionId(req)).toBe('thread-a');
  });

  it('keeps hosted threads isolated from each other', () => {
    const hostedUser = { id: 'user-abc', email: 'a@b.com', tier: 'free' };
    const threadA = {
      hostedUser,
      body: { sessionId: 'thread-a' },
      query: {},
    } as Parameters<typeof resolveExternalId>[0];
    const threadB = {
      hostedUser,
      body: { sessionId: 'thread-b' },
      query: {},
    } as Parameters<typeof resolveExternalId>[0];
    expect(resolveExternalId(threadA)).not.toBe(resolveExternalId(threadB));
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
