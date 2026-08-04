import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../store.js', () => ({
  getSessionHistory: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock('./contact-identity.js', () => ({
  aivaLegacyChannelSessionId: (workerId: string, channel: string, contactId: string) =>
    `aiva-${workerId}-${channel}-${contactId}`,
  listLinkedChannelContactIds: vi.fn(async () => ['app', 'tg-1']),
}));

describe('session-hydrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies only the current channel when unlinked', async () => {
    const { getSessionHistory, saveMemory } = await import('../store.js');
    vi.mocked(getSessionHistory)
      .mockResolvedValueOnce([]) // canonical empty
      .mockResolvedValueOnce([
        { role: 'user', content: 'hello from web', createdAt: new Date('2026-01-01') },
        { role: 'assistant', content: 'hi', createdAt: new Date('2026-01-02') },
      ] as never)
      .mockResolvedValue([]); // should not be needed for other channels when unlinked

    vi.mocked(saveMemory).mockResolvedValue(undefined);

    const { hydrateCanonicalSessionFromLinkedChannels } = await import('./session-hydrate.js');
    const result = await hydrateCanonicalSessionFromLinkedChannels({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      sessionId: 'aiva-w1-contact-app',
      channel: 'web',
      linked: false,
      channelContactIds: ['app'],
    });

    expect(result.hydrated).toBe(2);
    expect(saveMemory).toHaveBeenCalledWith('aiva-w1-contact-app', 'user', 'hello from web');
    expect(saveMemory).toHaveBeenCalledWith('aiva-w1-contact-app', 'assistant', 'hi');
    // Unlinked: only one legacy channel lookup after the canonical empty check.
    expect(getSessionHistory).toHaveBeenCalledTimes(2);
  });

  it('copies legacy channel turns into the canonical session when empty', async () => {
    const { getSessionHistory, saveMemory } = await import('../store.js');
    vi.mocked(getSessionHistory)
      .mockResolvedValueOnce([]) // canonical empty
      .mockResolvedValueOnce([
        { role: 'user', content: 'hello from web', createdAt: new Date('2026-01-01') },
        { role: 'assistant', content: 'hi', createdAt: new Date('2026-01-02') },
      ] as never)
      .mockResolvedValue([]); // other legacy channels empty

    vi.mocked(saveMemory).mockResolvedValue(undefined);

    const { hydrateCanonicalSessionFromLinkedChannels } = await import('./session-hydrate.js');
    const result = await hydrateCanonicalSessionFromLinkedChannels({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      sessionId: 'aiva-w1-contact-app',
      channelContactIds: ['app'],
      linked: true,
      channel: 'web',
    });

    expect(result.hydrated).toBe(2);
    expect(saveMemory).toHaveBeenCalledWith('aiva-w1-contact-app', 'user', 'hello from web');
    expect(saveMemory).toHaveBeenCalledWith('aiva-w1-contact-app', 'assistant', 'hi');
  });

  it('skips hydration when canonical session already has turns', async () => {
    const { getSessionHistory, saveMemory } = await import('../store.js');
    vi.mocked(getSessionHistory).mockResolvedValue([
      { role: 'user', content: 'already here' },
    ] as never);

    const { hydrateCanonicalSessionFromLinkedChannels } = await import('./session-hydrate.js');
    const result = await hydrateCanonicalSessionFromLinkedChannels({
      workspaceId: 'ws',
      workerId: 'w1',
      canonicalContactId: 'app',
      sessionId: 'aiva-w1-contact-app',
    });

    expect(result.hydrated).toBe(0);
    expect(saveMemory).not.toHaveBeenCalled();
  });
});
