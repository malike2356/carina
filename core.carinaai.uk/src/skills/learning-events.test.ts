import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildLearningIdempotencyKey,
  appendLearningEvent,
  hasLearningEvent,
  listLearningEvents,
  replayLearningEvent,
} from './learning-events.js';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

function mockPool(rows: unknown[] = [], rowCount = rows.length) {
  vi.doMock('../memory/db.js', () => ({
    pool: {
      query: vi.fn().mockResolvedValue({ rows, rowCount }),
    },
  }));
}

describe('learning-events', () => {
  it('builds stable idempotency keys', () => {
    const a = buildLearningIdempotencyKey({
      tenantId: 't1',
      sessionId: 's1',
      userMessage: 'fix this',
      toolsUsed: ['a', 'b'],
      succeeded: true,
      isCorrection: true,
    });
    const b = buildLearningIdempotencyKey({
      tenantId: 't1',
      sessionId: 's1',
      userMessage: 'fix this',
      toolsUsed: ['a', 'b'],
      succeeded: true,
      isCorrection: true,
    });
    expect(a).toBe(b);
    expect(a.length).toBe(40);
  });

  it('appendLearningEvent returns id on success', async () => {
    mockPool([{ id: 'evt-1' }]);
    const { appendLearningEvent: append } = await import('./learning-events.js');
    const id = await append({
      eventType: 'skill_created',
      skillName: 'demo',
    });
    expect(id).toBe('evt-1');
  });

  it('hasLearningEvent tolerates query failures', async () => {
    vi.doMock('../memory/db.js', () => ({
      pool: { query: vi.fn().mockRejectedValue(new Error('db down')) },
    }));
    const { hasLearningEvent: has } = await import('./learning-events.js');
    expect(await has('abc')).toBe(false);
  });

  it('replayLearningEvent returns internal notes separately', async () => {
    mockPool([{
      id: 'evt-2',
      tenant_id: '__operator__',
      session_id: 'sess',
      event_type: 'eval_malformed',
      idempotency_key: 'k',
      skill_id: null,
      skill_name: null,
      version: null,
      input_summary: { toolsUsed: 3 },
      output_summary: null,
      internal_notes: { raw: 'not json' },
      created_at: '2026-06-15T00:00:00Z',
    }]);
    const { replayLearningEvent: replay } = await import('./learning-events.js');
    const result = await replay('evt-2');
    expect(result.event?.eventType).toBe('eval_malformed');
    expect(result.internalNotes).toEqual({ raw: 'not json' });
  });

  it('listLearningEvents returns empty array on failure', async () => {
    vi.doMock('../memory/db.js', () => ({
      pool: { query: vi.fn().mockRejectedValue(new Error('db down')) },
    }));
    const { listLearningEvents: list } = await import('./learning-events.js');
    expect(await list()).toEqual([]);
  });
});
