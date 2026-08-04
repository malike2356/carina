import { beforeEach, describe, expect, it, vi } from 'vitest';

const listWorkerPersistentFacts = vi.fn();
const listPersistentFacts = vi.fn();
const getSessionHistory = vi.fn();
const getWorkerSessionContext = vi.fn();

vi.mock('../workers/worker-session-context.js', () => ({
  getWorkerSessionContext: (...args: unknown[]) => getWorkerSessionContext(...args),
}));

vi.mock('./aiva/worker-persistent-memory.js', () => ({
  listWorkerPersistentFacts: (...args: unknown[]) => listWorkerPersistentFacts(...args),
}));

vi.mock('./persistent-memory.js', () => ({
  listPersistentFacts: (...args: unknown[]) => listPersistentFacts(...args),
}));

vi.mock('./store.js', () => ({
  getSessionHistory: (...args: unknown[]) => getSessionHistory(...args),
}));

describe('formatScopedMemoryRecall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listWorkerPersistentFacts.mockResolvedValue([]);
    listPersistentFacts.mockResolvedValue([]);
    getSessionHistory.mockResolvedValue([]);
    getWorkerSessionContext.mockReturnValue(undefined);
  });

  it('returns only this worker/contact durable facts for Aiva sessions', async () => {
    getWorkerSessionContext.mockReturnValue({
      worker: { id: 'worker-a', workspaceId: 'ws-a' },
      contactId: 'contact-a',
      personaPrompt: '',
    });
    listWorkerPersistentFacts
      .mockResolvedValueOnce([{ content: 'User prefers short answers' }])
      .mockResolvedValueOnce([{ content: 'Keep tone professional' }]);

    const { formatScopedMemoryRecall } = await import('./scoped-recall.js');
    const text = await formatScopedMemoryRecall('aiva-worker-a-telegram-contact-a');

    expect(text).toContain('User prefers short answers');
    expect(text).toContain('Keep tone professional');
    expect(text).not.toContain('Recent memories');
    expect(listWorkerPersistentFacts).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-a',
        workerId: 'worker-a',
        target: 'user',
        contactId: 'contact-a',
      }),
    );
  });

  it('does not fall back to other tenants when worker memory is empty', async () => {
    getWorkerSessionContext.mockReturnValue({
      worker: { id: 'worker-b', workspaceId: 'ws-b' },
      contactId: 'contact-b',
      personaPrompt: '',
    });
    listWorkerPersistentFacts.mockResolvedValue([]);

    const { formatScopedMemoryRecall } = await import('./scoped-recall.js');
    const text = await formatScopedMemoryRecall('aiva-worker-b-web-contact-b');

    expect(text).toMatch(/nothing is stored yet/i);
    expect(getSessionHistory).not.toHaveBeenCalled();
    expect(listPersistentFacts).not.toHaveBeenCalled();
  });

  it('uses profile persistent facts for non-Aiva sessions', async () => {
    listPersistentFacts
      .mockResolvedValueOnce([{ content: 'Operator name is Malike' }])
      .mockResolvedValueOnce([]);

    const { formatScopedMemoryRecall } = await import('./scoped-recall.js');
    const text = await formatScopedMemoryRecall('cli-session-1');

    expect(text).toContain('Operator name is Malike');
    expect(listPersistentFacts).toHaveBeenCalledWith('user');
  });
});
