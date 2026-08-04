import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../embeddings.js', () => ({
  embed: vi.fn().mockResolvedValue([]),
}));

vi.mock('../memory-write-guard.js', () => ({
  guardMemoryWrite: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../memory-discipline.js', () => ({
  filterMemoryFactsForInjection: (lines: string[]) => lines,
  validateMemoryContent: () => ({ ok: true }),
}));

const { pool } = await import('../db.js');
const mockQuery = vi.mocked(pool.query);

const {
  addWorkerPersistentFact,
  buildWorkerDurableMemorySuffix,
  clearWorkerDurableMemorySnapshotsForTests,
  invalidateWorkerDurableMemorySnapshot,
} = await import('./worker-persistent-memory.js');

describe('worker durable memory isolation + freeze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWorkerDurableMemorySnapshotsForTests();
    mockQuery.mockReset();
  });

  it('freezes USER/MEMORY across builds until invalidate', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] } as never;
      if (sql.includes('FROM aiva_worker_persistent_facts') && sql.includes("target = 'user'")) {
        return {
          rows: [{
            id: 'u1',
            workspace_id: params?.[0],
            worker_id: params?.[1],
            contact_id: null,
            target: 'user',
            content: 'Prefers London time',
            created_at: '2026-07-01',
            updated_at: '2026-07-01',
          }],
        } as never;
      }
      if (sql.includes('FROM aiva_worker_persistent_facts')) {
        return {
          rows: [{
            id: 'm1',
            workspace_id: params?.[0],
            worker_id: params?.[1],
            contact_id: null,
            target: 'memory',
            content: 'Use concise replies',
            created_at: '2026-07-01',
            updated_at: '2026-07-01',
          }],
        } as never;
      }
      return { rows: [] } as never;
    });

    const opts = {
      workspaceId: 'ws-a',
      workerId: 'worker-a',
      contactId: 'contact-1',
    };
    const first = await buildWorkerDurableMemorySuffix(opts);
    const callsAfterFirst = mockQuery.mock.calls.length;
    const second = await buildWorkerDurableMemorySuffix(opts);
    expect(second).toBe(first);
    expect(mockQuery.mock.calls.length).toBe(callsAfterFirst);
    expect(first).toContain('worker-conversation-search');
    expect(first).not.toContain('session-search or /search');

    invalidateWorkerDurableMemorySnapshot(opts.workspaceId, opts.workerId);
    await buildWorkerDurableMemorySuffix(opts);
    expect(mockQuery.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('scopes fact inserts to workspace + worker and invalidates freeze', async () => {
    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('CREATE TABLE')) return { rows: [] } as never;
      if (sql.includes('FROM aiva_worker_persistent_facts') && sql.includes('ORDER BY')) {
        return { rows: [] } as never;
      }
      if (sql.includes('INSERT INTO aiva_worker_persistent_facts')) {
        return {
          rows: [{
            id: 'new-1',
            workspace_id: params?.[0],
            worker_id: params?.[1],
            contact_id: params?.[2],
            target: params?.[3],
            content: params?.[4],
            created_at: '2026-07-01',
            updated_at: '2026-07-01',
          }],
        } as never;
      }
      return { rows: [] } as never;
    });

    const fact = await addWorkerPersistentFact({
      workspaceId: 'ws-a',
      workerId: 'worker-a',
      target: 'memory',
      content: 'Standing order: morning digest at 08:00',
    });
    expect(fact.workspaceId).toBe('ws-a');
    expect(fact.workerId).toBe('worker-a');

    const insertCall = mockQuery.mock.calls.find((call) =>
      String(call[0]).includes('INSERT INTO aiva_worker_persistent_facts'),
    );
    expect(insertCall?.[1]).toEqual([
      'ws-a',
      'worker-a',
      null,
      'memory',
      'Standing order: morning digest at 08:00',
      null,
    ]);
  });
});
