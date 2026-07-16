import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('./session-lineage.js', () => ({
  getSessionParent: vi.fn(() => null),
  getSessionChain: vi.fn((id: string) => [{ sessionId: id }]),
  getLineageRoot: vi.fn((id: string) => id),
}));

const { pool } = await import('./db.js');
const mockQuery = vi.mocked(pool.query);

describe('session-scroll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns latest messages when no cursor is provided', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'm1', session_id: 's1', role: 'user', content: 'hi', created_at: '2026-01-01T00:00:00Z' },
      ],
    } as never);
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const { scrollSessionMessages } = await import('./session-scroll.js');
    const page = await scrollSessionMessages('s1', { limit: 10 });
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]?.content).toBe('hi');
  });
});
