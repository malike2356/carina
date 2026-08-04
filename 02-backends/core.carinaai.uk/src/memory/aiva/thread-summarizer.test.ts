import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../config/database-url.js', () => ({
  isDatabaseConfigured: () => true,
}));

vi.mock('../../brain/auxiliary-client.js', () => ({
  callAuxiliaryModel: vi.fn(async () =>
    'User prefers morning digests. Decision: apply for masters certificate. Topic: task tracking.',
  ),
}));

describe('thread-summarizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips when under trigger threshold', async () => {
    const { pool } = await import('../db.js');
    vi.mocked(pool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);

    const { maybeSummarizeThread } = await import('./thread-summarizer.js');
    const result = await maybeSummarizeThread({
      conversationId: '11111111-1111-1111-1111-111111111111',
      sessionEpoch: 1,
      totalTurns: 10,
    });
    expect(result).toBeNull();
  });

  it('compresses older turns and stores a summary', async () => {
    const { pool } = await import('../db.js');
    const { callAuxiliaryModel } = await import('../../brain/auxiliary-client.js');

    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes('ADD COLUMN') || text.includes('CREATE TABLE') || text.includes('CREATE INDEX')) {
        return { rows: [], rowCount: 0 };
      }
      if (text.includes('turn_number IS NULL')) {
        return { rows: [{ c: '0' }], rowCount: 1 };
      }
      if (text.includes('upper(covered_turn_range)')) {
        return { rows: [{ max_covered: 0 }], rowCount: 1 };
      }
      if (text.includes('SELECT turn_number, role, content')) {
        return {
          rows: [
            { turn_number: 1, role: 'user', content: 'My name is Laud' },
            { turn_number: 2, role: 'assistant', content: 'Noted, Laud' },
            { turn_number: 3, role: 'user', content: 'Put masters certificate on my task list' },
          ],
          rowCount: 3,
        };
      }
      if (text.includes('INSERT INTO aiva_thread_summaries')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const { maybeSummarizeThread } = await import('./thread-summarizer.js');
    const result = await maybeSummarizeThread({
      conversationId: '11111111-1111-1111-1111-111111111111',
      sessionEpoch: 1,
      totalTurns: 50,
      config: { triggerAfterTurns: 30, windowKeepRecent: 15 },
    });

    expect(result).not.toBeNull();
    expect(result?.coveredRange).toEqual([0, 35]);
    expect(result?.summaryText).toMatch(/masters certificate/i);
    expect(callAuxiliaryModel).toHaveBeenCalled();
    const insertCall = vi.mocked(pool.query).mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO aiva_thread_summaries'),
    );
    expect(insertCall).toBeTruthy();
  });

  it('formats summary prefix with budget', async () => {
    const { formatSummaryPrefix, SUMMARY_CHAR_BUDGET } = await import('./thread-summarizer.js');
    const prefix = formatSummaryPrefix(['Decision: keep Selorm on Telegram']);
    expect(prefix).toContain('Conversation summary');
    expect(prefix).toContain('Decision: keep Selorm on Telegram');
    expect(prefix.length).toBeLessThanOrEqual(SUMMARY_CHAR_BUDGET);
  });
});
