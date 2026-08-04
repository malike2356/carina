import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('./embeddings.js', () => ({
  embed: vi.fn().mockResolvedValue([]),
}));

vi.mock('../profiles/isolation.js', () => ({
  getActiveProfileOrDefault: vi.fn(() => 'work'),
}));

const { pool } = await import('./db.js');
const mockQuery = vi.mocked(pool.query);

describe('persistent-memory profile isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('scopes list queries to active profile', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const { listPersistentFacts } = await import('./persistent-memory.js');
    await listPersistentFacts('user');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(profile_name, 'default') = $2"),
      ['user', 'work'],
    );
  });

  it('inserts user facts without agent_name', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: '1',
          target: 'user',
          content: 'note',
          created_at: new Date().toISOString(),
        }],
      } as never);

    const { addPersistentFact } = await import('./persistent-memory.js');
    await addPersistentFact('user', 'note');
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO persistent_facts'));
    expect(insertCall?.[1]).toEqual(['user', 'note', null, 'work', null]);
  });
});
