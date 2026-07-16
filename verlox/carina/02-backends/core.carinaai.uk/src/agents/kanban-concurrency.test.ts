import { describe, expect, it, vi, beforeEach } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query },
}));

describe('kanban store concurrency', () => {
  beforeEach(() => {
    vi.resetModules();
    query.mockReset();
  });

  it('rejects move when version mismatches', async () => {
    const row = {
      id: 'card-1',
      session_id: 'op:default',
      board_id: 'default',
      title: 'Task',
      description: null,
      column_name: 'backlog',
      assignee: null,
      priority: 0,
      blocked: false,
      block_reason: null,
      linked_card_id: null,
      sort_order: 0,
      version: 2,
      work_prompt: null,
      result_summary: null,
      orchestrator_notes: null,
      target_role: 'any',
      closed_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    query.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM kanban_cards WHERE id')) {
        return { rows: [row] };
      }
      if (sql.includes('MAX(sort_order)')) {
        return { rows: [{ max: '0' }] };
      }
      return { rows: [] };
    });

    const { moveCard } = await import('./kanban-store.js');
    await expect(moveCard('card-1', 'in_progress', 'worker', 1)).rejects.toMatchObject({
      code: 'conflict',
    });
  });
});
