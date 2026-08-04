import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

vi.mock('../../protect/protect-audit.js', () => ({
  recordProtectAuditEvent: vi.fn().mockResolvedValue({ id: 'evt-1' }),
}));

import { verifySessionBlockTwoPlane } from '../../planes/enforcement-verifier.js';
import { recordProtectAuditEvent } from '../../protect/protect-audit.js';

describe('two-plane session block', () => {
  beforeEach(() => {
    query.mockReset();
    vi.mocked(recordProtectAuditEvent).mockClear();
  });

  it('verifies when blocked_sessions present before and after delay', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ session_id: 's1' }] }) // app plane
      .mockResolvedValueOnce({ rows: [{ session_id: 's1', reason: 'x', blocked_at: new Date() }] }) // independent
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] }); // insert verdict

    const result = await verifySessionBlockTwoPlane({
      accountId: '11111111-1111-1111-1111-111111111111',
      sessionId: 's1',
      delayMs: 1,
    });
    expect(result.verdict).toBe('verified');
    expect(recordProtectAuditEvent).not.toHaveBeenCalled();
  });

  it('raises disagreement incident when independent plane missing', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ session_id: 's1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 'v2' }] });

    const result = await verifySessionBlockTwoPlane({
      accountId: '11111111-1111-1111-1111-111111111111',
      sessionId: 's1',
      delayMs: 1,
    });
    expect(result.verdict).toBe('disagreement');
    expect(recordProtectAuditEvent).toHaveBeenCalled();
    expect(vi.mocked(recordProtectAuditEvent).mock.calls[0]![0].eventType).toBe('plane_disagreement');
  });
});
