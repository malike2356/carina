import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockPool = { query: mockQuery };

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  mockQuery.mockReset();
});

async function loadEpisodicPostgres() {
  vi.doMock('./db.js', () => ({ pool: mockPool }));
  vi.doMock('./embeddings.js', () => ({
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }));
  vi.doMock('pgvector/pg', () => ({
    default: { toSql: (v: number[]) => `[${v.join(',')}]` },
  }));
  return import('./episodic-postgres.js');
}

async function loadStore() {
  vi.doMock('./db.js', () => ({ pool: mockPool }));
  vi.doMock('./embeddings.js', () => ({
    embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }));
  vi.doMock('pgvector/pg', () => ({
    default: { toSql: (v: number[]) => `[${v.join(',')}]` },
  }));
  return import('./store.js');
}

describe('saveMemory', () => {
  it('inserts a row into episodic_memories', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const { saveMemory } = await loadEpisodicPostgres();
    await saveMemory('session-1', 'user', 'hello world');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO episodic_memories'),
      expect.arrayContaining(['session-1', 'user', 'hello world']),
    );
  });
});

describe('getSessionHistory', () => {
  it('queries by session_id and returns ordered rows', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { id: 'a', session_id: 's1', role: 'user', content: 'hi', created_at: new Date() },
        { id: 'b', session_id: 's1', role: 'assistant', content: 'hello', created_at: new Date() },
      ],
    });
    const { getSessionHistory } = await loadEpisodicPostgres();
    const result = await getSessionHistory('s1', 10);
    expect(result).toHaveLength(2);
    expect(result[0].role).toBe('user');
    expect(result[1].role).toBe('assistant');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('session_id = $1'),
      ['s1', 10],
    );
  });
});

describe('clearSession', () => {
  it('deletes rows for the given session', async () => {
    mockQuery.mockResolvedValue({ rowCount: 3 });
    const { clearSession } = await loadEpisodicPostgres();
    await clearSession('session-to-clear');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM episodic_memories'),
      ['session-to-clear'],
    );
  });
});

describe('searchRag', () => {
  it('returns empty array when embedding is empty', async () => {
    vi.doMock('./db.js', () => ({ pool: mockPool }));
    vi.doMock('./embeddings.js', () => ({
      embed: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('pgvector/pg', () => ({
      default: { toSql: (v: number[]) => `[${v.join(',')}]` },
    }));
    const { searchRag } = await import('./store.js');
    const result = await searchRag('anything', 5);
    expect(result).toEqual([]);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('queries rag_chunks by vector similarity', async () => {
    mockQuery.mockResolvedValue({
      rows: [
        { id: '1', source: 'hmo-guide.md', pack: 'property-uk', content: 'HMO rules' },
      ],
    });
    const { searchRag } = await loadStore();
    const result = await searchRag('HMO compliance', 3);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('hmo-guide.md');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('rag_chunks'),
      expect.any(Array),
    );
  });
});

describe('isSourceIngested', () => {
  it('returns true when source exists', async () => {
    mockQuery.mockResolvedValue({ rowCount: 1 });
    const { isSourceIngested } = await loadStore();
    expect(await isSourceIngested('docs/hmo.md')).toBe(true);
  });

  it('returns false when source not found', async () => {
    mockQuery.mockResolvedValue({ rowCount: 0 });
    const { isSourceIngested } = await loadStore();
    expect(await isSourceIngested('docs/missing.md')).toBe(false);
  });
});
