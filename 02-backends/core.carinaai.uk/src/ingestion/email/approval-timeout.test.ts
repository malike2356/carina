import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();

vi.mock('../../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('croner', () => {
  class CronMock {
    stop = vi.fn();
    constructor(_expr: string, _cb: () => void) {}
  }
  return { Cron: CronMock };
});

describe('expireTimedOutApprovals', () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it('returns count of expired rows', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 3 });
    const { expireTimedOutApprovals } = await import('./worker-approval-store.js');
    const count = await expireTimedOutApprovals();
    expect(count).toBe(3);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('timeout_at <= NOW()'),
    );
  });

  it('returns 0 when no approvals have timed out', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    const { expireTimedOutApprovals } = await import('./worker-approval-store.js');
    const count = await expireTimedOutApprovals();
    expect(count).toBe(0);
  });

  it('sets status to timeout and decision to timeout', async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 1 });
    const { expireTimedOutApprovals } = await import('./worker-approval-store.js');
    await expireTimedOutApprovals();
    const sql = queryMock.mock.calls[0]?.[0] as string;
    expect(sql).toContain("status = 'timeout'");
    expect(sql).toContain("decision = 'timeout'");
    expect(sql).toContain("status = 'pending'");
  });
});

describe('startEmailApprovalTimeoutScheduler', () => {
  beforeEach(() => {
    queryMock.mockReset();
    vi.resetModules();
  });

  it('starts a cron job on first call', async () => {
    const croner = await import('croner');
    const CronSpy = vi.spyOn(croner, 'Cron');
    const { startEmailApprovalTimeoutScheduler, stopEmailApprovalTimeoutScheduler } =
      await import('./approval-timeout-scheduler.js');
    stopEmailApprovalTimeoutScheduler();
    CronSpy.mockClear();
    startEmailApprovalTimeoutScheduler();
    expect(CronSpy).toHaveBeenCalledWith('*/10 * * * *', expect.any(Function));
  });

  it('is idempotent: second call does not start a second cron', async () => {
    const croner = await import('croner');
    const CronSpy = vi.spyOn(croner, 'Cron');
    const { startEmailApprovalTimeoutScheduler, stopEmailApprovalTimeoutScheduler } =
      await import('./approval-timeout-scheduler.js');
    stopEmailApprovalTimeoutScheduler();
    CronSpy.mockClear();
    startEmailApprovalTimeoutScheduler();
    startEmailApprovalTimeoutScheduler();
    expect(CronSpy).toHaveBeenCalledTimes(1);
  });

  it('stop clears the cron so a subsequent start works', async () => {
    const croner = await import('croner');
    const CronSpy = vi.spyOn(croner, 'Cron');
    const { startEmailApprovalTimeoutScheduler, stopEmailApprovalTimeoutScheduler } =
      await import('./approval-timeout-scheduler.js');
    stopEmailApprovalTimeoutScheduler();
    CronSpy.mockClear();
    startEmailApprovalTimeoutScheduler();
    stopEmailApprovalTimeoutScheduler();
    startEmailApprovalTimeoutScheduler();
    expect(CronSpy).toHaveBeenCalledTimes(2);
  });
});
