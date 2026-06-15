import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sessionSearchTool } from './session-search.js';

vi.mock('../memory/session-index.js', () => ({
  browseRecentSessions: vi.fn(),
  scrollSessionMessages: vi.fn(),
  searchSessionsAdvanced: vi.fn(),
}));

vi.mock('../memory/session-scope.js', () => ({
  searchMemoryScope: vi.fn(() => ({ sql: 'TRUE', params: [] })),
}));

vi.mock('../memory/session-lineage.js', () => ({
  getLineageRoot: vi.fn((id: string) => id),
  getSessionChain: vi.fn((id: string) => [{ sessionId: id }]),
  lineageRelatedSessionIds: vi.fn((id: string) => [id]),
}));

const { scrollSessionMessages, searchSessionsAdvanced, browseRecentSessions } = await import('../memory/session-index.js');
const mockScroll = vi.mocked(scrollSessionMessages);
const mockAdvanced = vi.mocked(searchSessionsAdvanced);
const mockBrowse = vi.mocked(browseRecentSessions);

describe('session-search tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scroll mode paginates with cursor and lineage', async () => {
    mockScroll.mockResolvedValue({
      sessionId: 'sess-1',
      messages: [{
        id: 'msg-1',
        sessionId: 'sess-1',
        role: 'user',
        content: 'hello',
        createdAt: new Date('2026-01-01'),
      }],
      hasOlder: true,
      hasNewer: false,
      oldestMessageId: 'msg-1',
      newestMessageId: 'msg-1',
      lineage: {
        rootSessionId: 'root',
        chain: [{ sessionId: 'sess-1' }],
        crossedFromParent: false,
      },
    });

    const result = await sessionSearchTool.execute({
      session_id: 'sess-1',
      cursor: 'msg-0',
      direction: 'older',
      include_lineage: true,
    });

    expect(mockScroll).toHaveBeenCalledWith('sess-1', expect.objectContaining({
      cursor: 'msg-0',
      direction: 'older',
      includeLineage: true,
    }));
    expect(result).toMatchObject({
      mode: 'scroll',
      hasOlder: true,
      nextCursor: 'msg-1',
    });
  });

  it('query mode returns lineage metadata on hits', async () => {
    mockAdvanced.mockResolvedValue({
      results: [{
        sessionId: 's1',
        messageId: 'm1',
        title: 'Test',
        snippet: 'match',
        timestamp: new Date('2026-06-01'),
        bookendStart: [],
        bookendEnd: [],
        contextWindow: [],
        rank: 0.8,
        matchStrategy: 'fts' as const,
      }],
      total: 1,
      page: 1,
      pageSize: 5,
      totalPages: 1,
      query: 'test',
      sort: 'relevance',
      strategy: 'fts',
      fallbackUsed: false,
      indexHealthy: true,
    });

    const result = await sessionSearchTool.execute({ query: 'test' }) as { results: Array<{ lineageRoot: string }> };
    expect(result.results[0]?.lineageRoot).toBe('s1');
  });

  it('browse mode when no params', async () => {
    mockBrowse.mockResolvedValue([]);
    const result = await sessionSearchTool.execute({});
    expect(result).toEqual({ mode: 'browse', results: [] });
  });
});
