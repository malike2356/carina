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

describe('persistent-memory agent store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CARINA_ACTIVE_AGENT = 'fleet';
  });

  it('scopes agent memory facts by agent_name', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const { listPersistentFacts } = await import('./persistent-memory.js');
    await listPersistentFacts('memory', 'fleet');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("COALESCE(agent_name, 'main') = $3"),
      ['memory', 'work', 'fleet'],
    );
  });

  it('keeps user facts profile-wide without agent_name', async () => {
    mockQuery.mockResolvedValue({ rows: [] } as never);
    const { listPersistentFacts } = await import('./persistent-memory.js');
    await listPersistentFacts('user');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('agent_name IS NULL'),
      ['user', 'work'],
    );
  });

  it('inserts agent memory with agent_name', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 0 }] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: '1',
          target: 'memory',
          content: 'fleet note',
          created_at: new Date().toISOString(),
        }],
      } as never);

    const { addPersistentFact } = await import('./persistent-memory.js');
    await addPersistentFact('memory', 'fleet note');
    const insertCall = mockQuery.mock.calls.find((c) => String(c[0]).includes('INSERT INTO persistent_facts'));
    expect(insertCall?.[1]).toEqual(['memory', 'fleet note', null, 'work', 'fleet']);
  });

  it('builds separate user and agent context blocks', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [{ id: '1', target: 'user', content: 'likes tea', created_at: new Date().toISOString() }],
      } as never)
      .mockResolvedValueOnce({
        rows: [{ id: '2', target: 'memory', content: 'fleet playbook', created_at: new Date().toISOString() }],
      } as never);

    const { getPersistentContextForAgent } = await import('./persistent-memory.js');
    const ctx = await getPersistentContextForAgent('fleet');
    expect(ctx).toContain('User profile');
    expect(ctx).toContain('likes tea');
    expect(ctx).toContain('Agent notes (fleet)');
    expect(ctx).toContain('fleet playbook');
  });
});
