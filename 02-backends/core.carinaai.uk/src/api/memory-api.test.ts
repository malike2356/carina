import express from 'express';
import session from 'express-session';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../memory/session-index.js', () => ({
  browseRecentSessions: vi.fn(),
  searchSessions: vi.fn(),
}));

vi.mock('../memory/session-search-service.js', () => ({
  searchSessionsAdvanced: vi.fn(),
  tenantScopeFromId: vi.fn((tenantId: string) => (
    tenantId === '__operator__' ? { sql: 'TRUE', params: [] } : { sql: 'session_id LIKE $1', params: [`${tenantId}:%`] }
  )),
}));

const { memoryApiRouter } = await import('./memory-api.js');
const { searchSessionsAdvanced } = await import('../memory/session-search-service.js');
const mockAdvanced = vi.mocked(searchSessionsAdvanced);

function makeApp() {
  const app = express();
  app.use(session({ secret: 'test', resave: false, saveUninitialized: true }));
  app.use((req, _res, next) => {
    req.session.webAuthed = true;
    next();
  });
  app.use('/api/memory', memoryApiRouter);
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

describe('memory-api session search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ranked paginated session search payload', async () => {
    mockAdvanced.mockResolvedValue({
      results: [{
        sessionId: 'sess-1',
        messageId: 'm-1',
        title: 'Deploy checklist',
        timestamp: new Date('2026-06-10'),
        snippet: 'deploy checklist for prod',
        bookendStart: [],
        bookendEnd: [],
        contextWindow: [],
        rank: 0.91,
        matchStrategy: 'fts',
      }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
      query: 'deploy',
      sort: 'relevance',
      strategy: 'fts',
      fallbackUsed: false,
      indexHealthy: true,
    });

    const { status, body } = await getJson('/api/memory/sessions/search?q=deploy&page=1&limit=20');

    expect(status).toBe(200);
    expect((body.results as Array<{ sessionId: string }>)[0]?.sessionId).toBe('sess-1');
    expect(body.strategy).toBe('fts');
    expect(mockAdvanced).toHaveBeenCalledWith(expect.objectContaining({
      query: 'deploy',
      limit: 20,
      offset: 0,
      sort: 'relevance',
    }));
  });

  it('returns empty payload for blank query', async () => {
    const { status, body } = await getJson('/api/memory/sessions/search?q=%20%20');
    expect(status).toBe(200);
    expect(body.results).toEqual([]);
    expect(mockAdvanced).not.toHaveBeenCalled();
  });
});
