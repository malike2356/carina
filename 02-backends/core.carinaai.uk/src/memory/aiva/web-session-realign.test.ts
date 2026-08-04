import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store.js', () => ({
  clearSession: vi.fn(),
  getSessionHistory: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock('../../aiva/employee-comms.js', () => ({
  listEmployeeThreadMessages: vi.fn(),
}));

vi.mock('../../brain/prompt-cache.js', () => ({
  forceImmediateInvalidation: vi.fn(),
}));

describe('web-session-realign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rewrites episodic when it has orphan turns not in the employee thread', async () => {
    const { getSessionHistory, clearSession, saveMemory } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');

    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({
      messages: [
        { sender: 'user', content: 'hello' },
        { sender: 'employee', content: 'Hi.' },
        { sender: 'user', content: "what's you name" },
        { sender: 'employee', content: 'Selorm.' },
      ],
    } as never);

    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'check my email' },
      { role: 'assistant', content: 'I looked up Resend and Gmail...' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi.' },
    ] as never);

    const { realignWebEpisodicToEmployeeThread } = await import('./web-session-realign.js');
    const result = await realignWebEpisodicToEmployeeThread({
      sessionId: 'aiva-w-contact-app',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'app',
      channel: 'web',
    });

    expect(result.realigned).toBe(true);
    expect(clearSession).toHaveBeenCalledWith('aiva-w-contact-app');
    expect(saveMemory).toHaveBeenCalledTimes(4);
    expect(saveMemory).toHaveBeenCalledWith('aiva-w-contact-app', 'user', 'hello');
    expect(saveMemory).toHaveBeenCalledWith('aiva-w-contact-app', 'assistant', 'Selorm.');
  });

  it('does not realign when episodic matches the visible thread', async () => {
    const { getSessionHistory, clearSession } = await import('../store.js');
    const { listEmployeeThreadMessages } = await import('../../aiva/employee-comms.js');

    vi.mocked(listEmployeeThreadMessages).mockResolvedValue({
      messages: [
        { sender: 'user', content: 'hello' },
        { sender: 'employee', content: 'Hi.' },
      ],
    } as never);
    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'Hi.' },
    ] as never);

    const { realignWebEpisodicToEmployeeThread } = await import('./web-session-realign.js');
    const result = await realignWebEpisodicToEmployeeThread({
      sessionId: 'aiva-w-contact-app',
      workspaceId: 'ws',
      workerId: 'w',
      contactId: 'app',
      channel: 'web',
    });

    expect(result).toEqual({ realigned: false, reason: 'aligned' });
    expect(clearSession).not.toHaveBeenCalled();
  });
});
