import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store.js', () => ({
  getSessionHistory: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock('../../aiva/employee-comms.js', () => ({
  listEmployeeThreadMessages: vi.fn(),
}));

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../config/index.js', () => ({
  config: { carina: { maxMemoryContext: 20 } },
}));

vi.mock('./thread-summarizer.js', () => ({
  DEFAULT_SUMMARIZATION_CONFIG: {
    triggerAfterTurns: 30,
    windowKeepRecent: 15,
    maxSummaryTokens: 500,
  },
  SUMMARY_CHAR_BUDGET: 1200,
  countConversationTurns: vi.fn(async () => 0),
  formatSummaryPrefix: vi.fn((summaries: string[]) =>
    summaries.length
      ? `## Conversation summary (earlier)\n\n${summaries.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}\n\n---`
      : '',
  ),
  loadThreadSummaries: vi.fn(async () => [] as string[]),
  triggerSummarizeThread: vi.fn(),
}));

describe('conversation-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
  });

  it('hydrates episodic from employee thread when episodic is empty', async () => {
    const { getSessionHistory, saveMemory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    vi.mocked(getSessionHistory).mockResolvedValue([]);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({
      messages: [
        { sender: 'user', content: 'Hi Selorm' },
        { sender: 'employee', content: 'Hello Laud' },
        { sender: 'user', content: 'current turn' },
      ],
    } as never);
    vi.mocked(saveMemory).mockResolvedValue(undefined);

    const { hydrateEpisodicFromEmployeeThread } = await import('./conversation-bridge.js');
    const result = await hydrateEpisodicFromEmployeeThread({
      sessionId: 'aiva-w-web-c',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c',
      channel: 'web',
      currentUserMessage: 'current turn',
    });

    expect(result.source).toBe('employee_thread');
    expect(result.hydrated).toBe(2);
    expect(saveMemory).toHaveBeenCalledWith('aiva-w-web-c', 'user', 'Hi Selorm');
    expect(saveMemory).toHaveBeenCalledWith('aiva-w-web-c', 'assistant', 'Hello Laud');
    expect(saveMemory).not.toHaveBeenCalledWith('aiva-w-web-c', 'user', 'current turn');
  });

  it('skips hydrate when episodic already has turns', async () => {
    const { getSessionHistory, saveMemory } = await import('../store.js');
    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'already there' },
    ] as never);

    const { hydrateEpisodicFromEmployeeThread } = await import('./conversation-bridge.js');
    const result = await hydrateEpisodicFromEmployeeThread({
      sessionId: 'aiva-w-web-c',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c',
      channel: 'web',
    });

    expect(result).toEqual({ hydrated: 0, source: 'episodic' });
    expect(saveMemory).not.toHaveBeenCalled();
  });

  it('adds continuation hint when history exists', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'prior' },
      { role: 'assistant', content: 'reply' },
    ] as never);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-web-c',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c',
      channel: 'web',
    });

    expect(bridge.source).toBe('episodic');
    expect(bridge.continuationHint).toMatch(/Do not re-introduce/);
  });

  it('falls back to worker-wide recent episodic turns from other channels', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const { pool } = await import('../db.js');
    vi.mocked(getSessionHistory).mockResolvedValue([]);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          { role: 'user', content: 'We discussed onboarding from Telegram' },
          { role: 'assistant', content: 'I said I would prepare the checklist' },
        ],
      } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-workspace-owner',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'app',
      channel: 'web',
      linkedContactIds: ['app', 'tg-1'],
    });

    expect(bridge.source).toBe('worker_recent');
    expect(bridge.turns).toHaveLength(2);
    expect(bridge.continuationHint).toMatch(/linked channel/);
    const episodicSql = String(vi.mocked(pool.query).mock.calls[1]?.[0] ?? '');
    expect(episodicSql).toMatch(/INTERVAL '4 hours'/);
    const sessionArg = vi.mocked(pool.query).mock.calls[1]?.[1]?.[0] as string[] | undefined;
    expect(sessionArg?.sort()).toEqual(['aiva-w-contact-app', 'aiva-w-contact-tg-1'].sort());
    expect(sessionArg?.some((id) => /-(web|telegram|whatsapp|email)-/.test(id))).toBe(false);
  });

  it('legacy fallback never expands channel wildcards across contacts', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const { pool } = await import('../db.js');
    vi.mocked(getSessionHistory).mockResolvedValue([]);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{ role: 'user', content: 'exact contact only' }],
      } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    await resolveAivaConversationBridge({
      sessionId: 'aiva-w-web-other',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c1',
      channel: 'web',
      linkedContactIds: ['c1', 'c2'],
    });

    const sessionArg = vi.mocked(pool.query).mock.calls[1]?.[1]?.[0] as string[] | undefined;
    expect(sessionArg).toHaveLength(2);
    expect(sessionArg?.every((id) => id.includes('-contact-'))).toBe(true);
    expect(sessionArg?.some((id) => id.includes('-telegram-') || id.includes('-web-'))).toBe(false);
  });

  it('with a pinned conversationId does not fall back to legacy contact-* sessions', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const { pool } = await import('../db.js');
    vi.mocked(getSessionHistory).mockResolvedValue([]);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    // Other linked channel has a different pinned conversation.
    vi.mocked(pool.query)
      .mockResolvedValueOnce({
        rows: [
          { conversation_id: '11111111-1111-1111-1111-111111111111' },
          { conversation_id: '22222222-2222-2222-2222-222222222222' },
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ role: 'user', content: 'from other pinned conv only' }],
      } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-conv-11111111-1111-1111-1111-111111111111',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: '7028923891',
      channel: 'telegram',
      linkedContactIds: ['7028923891', 'workspace-owner'],
      conversationId: '11111111-1111-1111-1111-111111111111',
    });

    const sessionArg = vi.mocked(pool.query).mock.calls[1]?.[1]?.[0] as string[] | undefined;
    expect(sessionArg?.every((id) => id.includes('-conv-'))).toBe(true);
    expect(sessionArg?.some((id) => id.includes('-contact-'))).toBeFalsy();
    expect(bridge.source).toBe('worker_recent');
    expect(bridge.turns.map((t) => t.content)).toEqual(['from other pinned conv only']);
  });

  it('merges recent worker turns from other channels when current channel has history', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const { pool } = await import('../db.js');
    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'Current web question' },
    ] as never);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [
          { role: 'user', content: 'Telegram context to keep' },
          { role: 'assistant', content: 'Telegram reply to keep' },
        ],
      } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-web-c',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c',
      channel: 'web',
      linkedContactIds: ['c', 'tg-9'],
    });

    expect(bridge.source).toBe('worker_recent');
    expect(bridge.turns.map((turn) => turn.content)).toEqual([
      'Telegram context to keep',
      'Telegram reply to keep',
      'Current web question',
    ]);
  });

  it('does not pull other-channel episodic when contacts are not linked', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const { pool } = await import('../db.js');
    vi.mocked(getSessionHistory).mockResolvedValue([]);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ role: 'user', content: 'should not appear' }],
    } as never);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-contact-app',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'app',
      channel: 'web',
      linkedContactIds: ['app'],
    });

    expect(bridge.source).toBe('none');
    expect(bridge.turns).toHaveLength(0);
    expect(bridge.summaryPrefix).toBe('');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('injects summary and keeps recent window when summaries exist', async () => {
    const { getSessionHistory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');
    const {
      countConversationTurns,
      loadThreadSummaries,
      triggerSummarizeThread,
    } = await import('./thread-summarizer.js');

    const turns = Array.from({ length: 20 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${i + 1}`,
    }));
    vi.mocked(getSessionHistory).mockResolvedValue(turns as never);
    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({ messages: [] } as never);
    vi.mocked(countConversationTurns).mockResolvedValue(50);
    vi.mocked(loadThreadSummaries).mockResolvedValue([
      'User is Laud. Decision: apply for masters certificate.',
    ]);

    const { resolveAivaConversationBridge } = await import('./conversation-bridge.js');
    const bridge = await resolveAivaConversationBridge({
      sessionId: 'aiva-w-conv-11111111-1111-1111-1111-111111111111',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'c',
      channel: 'telegram',
      conversationId: '11111111-1111-1111-1111-111111111111',
      sessionEpoch: 1,
    });

    expect(triggerSummarizeThread).toHaveBeenCalled();
    expect(bridge.summaryPrefix).toContain('masters certificate');
    expect(bridge.turns).toHaveLength(15);
    expect(bridge.turns[0]?.content).toBe('turn-6');
    expect(bridge.turns.at(-1)?.content).toBe('turn-20');
  });
});
