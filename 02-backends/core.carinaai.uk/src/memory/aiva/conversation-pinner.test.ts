import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database-url.js', () => ({
  isDatabaseConfigured: () => true,
}));

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

describe('conversation-pinner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('builds stable aiva-*-conv-* session ids', async () => {
    const { aivaConversationSessionId, parseConversationIdFromSessionId } = await import(
      './conversation-pinner.js'
    );
    const conversationId = '11111111-2222-3333-4444-555555555555';
    const sessionId = aivaConversationSessionId('c177fe51-0e1e-441b-99d1-4c1cd64da55c', conversationId);
    expect(sessionId).toBe(
      'aiva-c177fe51-0e1e-441b-99d1-4c1cd64da55c-conv-11111111-2222-3333-4444-555555555555',
    );
    expect(parseConversationIdFromSessionId(sessionId)).toBe(conversationId);
  });

  it('returns an existing pinned conversation_id without regenerating', async () => {
    const { pool } = await import('../db.js');
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never) // ensure schema (PINNING_SQL)
      .mockResolvedValueOnce({ rows: [] } as never) // backfill episodic
      .mockResolvedValueOnce({
        rows: [{
          conversation_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          session_epoch: 2,
        }],
      } as never);

    const { resolveOrCreateConversation } = await import('./conversation-pinner.js');
    const first = await resolveOrCreateConversation({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: '7028923891',
    });
    expect(first).toEqual({
      conversationId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      sessionEpoch: 2,
      isNew: false,
    });

    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        conversation_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        session_epoch: 2,
      }],
    } as never);
    const second = await resolveOrCreateConversation({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: '7028923891',
    });
    expect(second.conversationId).toBe(first.conversationId);
  });

  it('inserts a new pin when no channel_threads row exists', async () => {
    const { pool } = await import('../db.js');
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never) // schema
      .mockResolvedValueOnce({ rows: [] } as never) // backfill
      .mockResolvedValueOnce({ rows: [] } as never) // select miss
      .mockResolvedValueOnce({
        rows: [{
          conversation_id: '99999999-8888-7777-6666-555555555555',
          session_epoch: 1,
        }],
      } as never);

    const { resolveOrCreateConversation } = await import('./conversation-pinner.js');
    const created = await resolveOrCreateConversation({
      workspaceId: 'ws',
      workerId: 'w1',
      channel: 'telegram',
      contactId: '7028923891',
    });
    expect(created.isNew).toBe(true);
    expect(created.conversationId).toBe('99999999-8888-7777-6666-555555555555');
    const insertSql = String(vi.mocked(pool.query).mock.calls.at(-1)?.[0] ?? '');
    expect(insertSql).toMatch(/INSERT INTO channel_threads/);
  });
});
