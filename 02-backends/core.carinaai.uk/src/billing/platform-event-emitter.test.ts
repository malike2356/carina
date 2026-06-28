import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

describe('platform-event-emitter', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('emitPlatformEvent', () => {
    it('inserts a row with all fields', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      const { emitPlatformEvent } = await import('./platform-event-emitter.js');
      await emitPlatformEvent({
        orgId: 'org-1',
        partnerId: 'partner-1',
        eventType: 'message',
        model: 'deepseek-chat',
        provider: 'deepseek',
        tokensIn: 100,
        tokensOut: 50,
        latencyMs: 320,
        scoutVerified: true,
      });
      expect(query).toHaveBeenCalledOnce();
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO platform_events');
      expect(params[0]).toBe('org-1');
      expect(params[1]).toBe('partner-1');
      expect(params[2]).toBe('message');
      expect(params[5]).toBe(100);
      expect(params[6]).toBe(50);
      expect(params[10]).toBe(320);
      expect(params[11]).toBe(true);
    });

    it('uses null defaults for optional fields', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      const { emitPlatformEvent } = await import('./platform-event-emitter.js');
      await emitPlatformEvent({ eventType: 'scout_audit', scoutVerified: true });
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params[0]).toBeNull();
      expect(params[1]).toBeNull();
      expect(params[5]).toBe(0);
      expect(params[6]).toBe(0);
      expect(params[10]).toBeNull();
    });

    it('does not throw when the query fails', async () => {
      query.mockRejectedValueOnce(new Error('db offline'));
      const { emitPlatformEvent } = await import('./platform-event-emitter.js');
      await expect(emitPlatformEvent({ eventType: 'tool_call' })).resolves.toBeUndefined();
    });
  });

  describe('getPlatformEventSummary', () => {
    it('aggregates rows by event_type', async () => {
      query.mockResolvedValueOnce({
        rows: [
          { event_type: 'message',   event_count: 10, tokens_in: 1000, tokens_out: 500, tool_calls: 0, skill_calls: 0, fee_pence: 5 },
          { event_type: 'tool_call', event_count: 3,  tokens_in: 0,    tokens_out: 0,   tool_calls: 3, skill_calls: 0, fee_pence: 0 },
        ],
      });
      const { getPlatformEventSummary } = await import('./platform-event-emitter.js');
      const summary = await getPlatformEventSummary({
        partnerId: 'p-1',
        fromDate: new Date('2026-06-01'),
        toDate: new Date('2026-07-01'),
      });
      expect(summary.totalEvents).toBe(13);
      expect(summary.totalTokensIn).toBe(1000);
      expect(summary.totalTokensOut).toBe(500);
      expect(summary.totalToolCalls).toBe(3);
      expect(summary.totalFeePence).toBe(5);
      expect(summary.byType.message).toBe(10);
      expect(summary.byType.tool_call).toBe(3);
    });

    it('returns zeroed summary when no rows', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const { getPlatformEventSummary } = await import('./platform-event-emitter.js');
      const summary = await getPlatformEventSummary({
        fromDate: new Date('2026-06-01'),
        toDate: new Date('2026-07-01'),
      });
      expect(summary.totalEvents).toBe(0);
      expect(summary.totalFeePence).toBe(0);
      expect(summary.byType).toEqual({});
    });

    it('adds org_id condition when orgId provided', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const { getPlatformEventSummary } = await import('./platform-event-emitter.js');
      await getPlatformEventSummary({
        orgId: 'org-abc',
        fromDate: new Date('2026-06-01'),
        toDate: new Date('2026-07-01'),
      });
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('org_id');
      expect(params).toContain('org-abc');
    });
  });
});
