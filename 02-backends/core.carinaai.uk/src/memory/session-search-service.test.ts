import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearSessionSearchCacheForTests,
  searchSessionsAdvanced,
  tenantScopeFromId,
} from './session-search-service.js';
import { mergeBestPerSession, sortSessionMatches, type RawSessionMatch } from './session-search-ranking.js';
import { operatorMemoryScope } from '../profiles/isolation.js';

vi.mock('./db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('./embeddings.js', () => ({
  embed: vi.fn().mockResolvedValue([]),
}));

const { pool } = await import('./db.js');
const mockQuery = vi.mocked(pool.query);

function ftsRow(sessionId: string, rank: number, createdAt = '2026-06-10'): Record<string, unknown> {
  return {
    message_id: `${sessionId}-m`,
    session_id: sessionId,
    role: 'user',
    content: `talking about ${sessionId}`,
    created_at: createdAt,
    snippet: `snippet ${sessionId}`,
    fts_rank: rank,
  };
}

describe('session-search-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    clearSessionSearchCacheForTests();
  });

  it('tenantScopeFromId scopes operator to active profile memory', () => {
    const scope = tenantScopeFromId('__operator__');
    const expected = operatorMemoryScope();
    expect(scope.sql).toBe(expected.sql);
    expect(scope.params).toEqual(expected.params);
  });

  it('falls back to hybrid search when FTS returns no rows', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ indexname: 'episodic_memories_tsv_idx' }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{
          message_id: 'm1',
          session_id: 'sess-a',
          role: 'user',
          content: 'docker compose setup',
          created_at: '2026-06-01',
          snippet: 'docker compose setup',
          prefix_rank: 0.2,
          fuzzy_rank: 0,
        }],
      } as never)
      .mockResolvedValue({ rows: [{ role: 'user', content: 'hello' }] } as never);

    const result = await searchSessionsAdvanced({ query: 'docker', limit: 5, enableSemantic: false });

    expect(result.fallbackUsed).toBe(true);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.sessionId).toBe('sess-a');
  });

  it('ranks higher fts sessions ahead of weaker matches', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ indexname: 'episodic_memories_tsv_idx' }] } as never)
      .mockResolvedValueOnce({
        rows: [ftsRow('alpha', 0.2), ftsRow('zulu', 0.9)],
      } as never)
      .mockResolvedValue({ rows: [{ role: 'user', content: 'hello' }] } as never);

    const result = await searchSessionsAdvanced({
      query: 'deployment',
      limit: 2,
      enableSemantic: false,
    });

    expect(result.results[0]?.sessionId).toBe('zulu');
    expect(result.fallbackUsed).toBe(false);
  });

  it('returns empty response when hybrid fallback also fails', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockRejectedValueOnce(new Error('fts down'))
      .mockRejectedValueOnce(new Error('ilike down'));

    const result = await searchSessionsAdvanced({ query: 'broken', enableSemantic: false });

    expect(result.results).toEqual([]);
    expect(result.fallbackUsed).toBe(true);
    expect(result.indexHealthy).toBe(false);
  });

  it('paginates deterministically by relevance', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('pg_indexes')) {
        return { rows: [{ indexname: 'episodic_memories_tsv_idx' }] } as never;
      }
      if (sql.includes('content_tsv @@')) {
        return {
          rows: [ftsRow('s1', 0.9), ftsRow('s2', 0.5), ftsRow('s3', 0.3)],
        } as never;
      }
      return { rows: [{ role: 'user', content: 'hello' }] } as never;
    });

    const page1 = await searchSessionsAdvanced({ query: 'ops', limit: 2, offset: 0, enableSemantic: false });
    const page2 = await searchSessionsAdvanced({ query: 'ops', limit: 2, offset: 2, enableSemantic: false });

    expect(page1.total).toBe(3);
    expect(page1.results).toHaveLength(2);
    expect(page2.results).toHaveLength(1);
    expect(page1.results[0]?.sessionId).toBe('s1');
    expect(page2.results[0]?.sessionId).toBe('s3');
  });
});

describe('session-search performance', () => {
  it('merges and sorts 2000 candidates within budget', () => {
    const rows: RawSessionMatch[] = Array.from({ length: 2000 }, (_, i) => ({
      sessionId: `s-${i % 400}`,
      messageId: `m-${i}`,
      role: 'user',
      content: `content ${i}`,
      createdAt: new Date(2026, 0, 1 + (i % 28)),
      snippet: `snippet ${i}`,
      ftsRank: Math.random(),
      prefixRank: 0,
      fuzzyRank: 0,
      semanticRank: 0,
      matchStrategy: 'fts',
    }));

    const start = performance.now();
    const merged = mergeBestPerSession(rows);
    const sorted = sortSessionMatches(merged, 'relevance');
    const elapsed = performance.now() - start;

    expect(sorted.length).toBe(400);
    expect(elapsed).toBeLessThan(80);
  });
});
