import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../session-search-service.js', () => ({
  searchSessionsAdvanced: vi.fn(),
}));

const { pool } = await import('../db.js');
const { searchSessionsAdvanced } = await import('../session-search-service.js');
const { searchWorkerConversations } = await import('./conversation-search.js');

const mockQuery = vi.mocked(pool.query);
const mockSearch = vi.mocked(searchSessionsAdvanced);

describe('searchWorkerConversations isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockSearch.mockReset();
  });

  it('returns empty when worker is not in the workspace', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);
    const hits = await searchWorkerConversations({
      workspaceId: 'ws-a',
      workerId: 'worker-b',
      query: 'secret',
    });
    expect(hits).toEqual([]);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('passes tenantScope and drops foreign session prefixes', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ '?column?': 1 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);
    mockSearch.mockResolvedValue({
      results: [
        {
          sessionId: 'aiva-worker-a-conv-1',
          messageId: 'm1',
          title: 'ok',
          timestamp: new Date('2026-07-01'),
          snippet: 'mine',
          bookendStart: [],
          bookendEnd: [],
          contextWindow: [],
          rank: 1,
          matchStrategy: 'fts',
        },
        {
          sessionId: 'aiva-worker-other-conv-1',
          messageId: 'm2',
          title: 'leak',
          timestamp: new Date('2026-07-01'),
          snippet: 'theirs',
          bookendStart: [],
          bookendEnd: [],
          contextWindow: [],
          rank: 1,
          matchStrategy: 'fts',
        },
      ],
      total: 2,
      page: 1,
      pageSize: 10,
      totalPages: 1,
      query: 'secret',
      sort: 'relevance',
      strategy: 'fts',
      fallbackUsed: false,
      indexHealthy: true,
    });

    const hits = await searchWorkerConversations({
      workspaceId: 'ws-a',
      workerId: 'worker-a',
      query: 'secret',
      limit: 10,
    });

    expect(mockSearch).toHaveBeenCalledWith(expect.objectContaining({
      tenantScope: {
        sql: 'session_id LIKE $1',
        params: ['aiva-worker-a-%'],
      },
    }));
    expect(hits).toHaveLength(1);
    expect(hits[0]?.sessionId).toBe('aiva-worker-a-conv-1');
  });
});
