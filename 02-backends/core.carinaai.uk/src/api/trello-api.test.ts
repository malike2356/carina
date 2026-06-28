import express from 'express';
import { AddressInfo } from 'node:net';
import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockTrelloClient(overrides: Record<string, unknown> = {}) {
  return {
    trelloConfigHint: () => 'Trello is not configured',
    listTrelloBoards: async () => [{ id: 'b1', name: 'Board', url: 'https://trello.com/b/1' }],
    listTrelloLists: async () => [{ id: 'l1', name: 'Todo' }],
    listTrelloCards: async () => [{ id: 'c1', name: 'Card', url: 'https://trello.com/c/1' }],
    getTrelloCard: async () => ({ id: 'c1', name: 'Card', url: 'https://trello.com/c/1' }),
    createTrelloCard: async () => ({ id: 'c2', name: 'New', url: 'https://trello.com/c/2' }),
    moveTrelloCard: async () => undefined,
    addTrelloComment: async () => undefined,
    archiveTrelloCard: async () => undefined,
    ...overrides,
  };
}

function mockCredentials(overrides: Record<string, unknown> = {}) {
  return {
    isTrelloConfigured: async () => true,
    getTrelloSettingsStatus: async () => ({ configured: true, source: 'stored', apiKeyMask: 'abcd...yz' }),
    trelloConfigHint: () => 'Trello is not configured',
    runWithTrelloTenantScope: (_id: string | null, fn: () => unknown) => fn(),
    saveTrelloCredentials: async () => undefined,
    clearTrelloCredentials: async () => undefined,
    ...overrides,
  };
}

async function withApp(
  setup: (app: express.Express) => Promise<void> | void,
): Promise<{ port: number; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  await setup(app);
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = (server.address() as AddressInfo).port;
  return {
    port,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('trelloApiRouter', () => {
  it('lists boards', async () => {
    vi.doMock('../integrations/trello-credentials.js', () => mockCredentials());
    vi.doMock('../integrations/trello-client.js', () => mockTrelloClient());
    const { trelloApiRouter } = await import('./trello-api.js');
    const { port, close } = await withApp((app) => {
      app.use('/api/trello', trelloApiRouter);
    });

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/trello/boards`);
      const body = await res.json() as { boards: Array<{ name: string }> };
      expect(res.status).toBe(200);
      expect(body.boards[0].name).toBe('Board');
    } finally {
      await close();
    }
  });

  it('rejects data routes when credentials are missing', async () => {
    vi.doMock('../integrations/trello-credentials.js', () => mockCredentials({
      isTrelloConfigured: async () => false,
      getTrelloSettingsStatus: async () => ({ configured: false, source: 'none' }),
    }));
    vi.doMock('../integrations/trello-client.js', () => mockTrelloClient());
    const { trelloApiRouter } = await import('./trello-api.js');
    const { port, close } = await withApp((app) => {
      app.use('/api/trello', trelloApiRouter);
    });

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/trello/boards`);
      expect(res.status).toBe(503);
    } finally {
      await close();
    }
  });

  it('returns settings status when unconfigured', async () => {
    vi.doMock('../integrations/trello-credentials.js', () => mockCredentials({
      isTrelloConfigured: async () => false,
      getTrelloSettingsStatus: async () => ({ configured: false, source: 'none' }),
    }));
    vi.doMock('../integrations/trello-client.js', () => mockTrelloClient());
    const { trelloApiRouter } = await import('./trello-api.js');
    const { port, close } = await withApp((app) => {
      app.use('/api/trello', trelloApiRouter);
    });

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/trello/settings`);
      const body = await res.json() as { configured: boolean };
      expect(res.status).toBe(200);
      expect(body.configured).toBe(false);
    } finally {
      await close();
    }
  });
});
