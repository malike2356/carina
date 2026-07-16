import express from 'express';
import session from 'express-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSessionHistory = vi.fn();
const mockStartWebSession = vi.fn();
const mockResolveExternalId = vi.fn();

vi.mock('../memory/store.js', () => ({
  getSessionHistory: (...args: unknown[]) => mockGetSessionHistory(...args),
}));

vi.mock('../gateway/router.js', () => ({
  getRouter: () => ({
    startWebSession: (...args: unknown[]) => mockStartWebSession(...args),
  }),
}));

vi.mock('../gateway/hosted-chat.js', () => ({
  resolveExternalId: (...args: unknown[]) => mockResolveExternalId(...args),
}));

const { chatHistoryRouter } = await import('./chat-history-api.js');

function makeApp() {
  const app = express();
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    req.session.webAuthed = true;
    next();
  });
  app.use('/api/chat', chatHistoryRouter);
  return app;
}

async function getJson(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const app = makeApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const body = await res.json() as Record<string, unknown>;
    return { status: res.status, body };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('chat-history-api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveExternalId.mockReturnValue('client-session-1');
    mockStartWebSession.mockResolvedValue({ sessionId: 'storage-session-1', agentId: 'main' });
    mockGetSessionHistory.mockResolvedValue([
      {
        id: 'm1',
        sessionId: 'storage-session-1',
        role: 'user',
        content: 'hello',
        createdAt: new Date('2026-06-14T10:00:00.000Z'),
      },
      {
        id: 'm2',
        sessionId: 'storage-session-1',
        role: 'assistant',
        content: 'hi there',
        createdAt: new Date('2026-06-14T10:00:05.000Z'),
      },
    ]);
  });

  it('returns chronological messages for a client session id', async () => {
    const { status, body } = await getJson('/api/chat/history/client-session-1?limit=100');

    expect(status).toBe(200);
    expect(body.sessionId).toBe('client-session-1');
    expect(mockStartWebSession).toHaveBeenCalledWith('client-session-1');
    expect(mockGetSessionHistory).toHaveBeenCalledWith('storage-session-1', 101, undefined);
    const messages = body.messages as Array<{ id: string; role: string }>;
    expect(messages).toHaveLength(2);
    expect(messages[0]?.id).toBe('m1');
    expect(messages[1]?.role).toBe('assistant');
  });

  it('rejects invalid before timestamps', async () => {
    const { status, body } = await getJson('/api/chat/history/client-session-1?before=not-a-date');
    expect(status).toBe(400);
    expect(body.error).toBe('before must be a valid ISO timestamp');
  });
});
