import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store.js', () => ({
  getSessionHistory: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock('../../aiva/employee-comms.js', () => ({
  listEmployeeThreadMessages: vi.fn(),
}));

vi.mock('../../config/index.js', () => ({
  config: { carina: { maxMemoryContext: 20 } },
}));

describe('conversation-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
