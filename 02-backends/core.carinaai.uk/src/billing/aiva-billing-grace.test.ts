import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const pauseWorkerMock = vi.fn(async () => undefined);
const listWorkersMock = vi.fn(async () => []);
const sendSuspendedEmailMock = vi.fn(async () => undefined);
const firstWorkerNameMock = vi.fn(async () => 'Aria');

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../workers/worker-store.js', () => ({
  listWorkers: (...args: unknown[]) => listWorkersMock(...args),
  pauseWorker: (...args: unknown[]) => pauseWorkerMock(...args),
  resumeWorker: vi.fn(async () => undefined),
}));

vi.mock('../email/email-triggers.js', () => ({
  sendSubscriptionSuspendedEmail: (...args: unknown[]) => sendSuspendedEmailMock(...args),
  sendSubscriptionReactivatedEmail: vi.fn(async () => undefined),
  firstWorkerName: (...args: unknown[]) => firstWorkerNameMock(...args),
}));

vi.mock('../email/workspace-contact.js', () => ({
  aivaAppUrl: (path: string) => `https://admin.hireaiva.co.uk${path}`,
}));

describe('aiva billing grace', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    pauseWorkerMock.mockClear();
    sendSuspendedEmailMock.mockClear();
    listWorkersMock.mockReset();
    listWorkersMock.mockResolvedValue([]);
    delete process.env.AIVA_GRACE_PERIOD_DAYS;
  });

  it('defaults grace period to 7 days', async () => {
    const { gracePeriodDays, gracePeriodEndsAt } = await import('./aiva-billing.js');
    expect(gracePeriodDays()).toBe(7);
    const ends = gracePeriodEndsAt(new Date('2026-06-01T00:00:00.000Z'));
    expect(ends.toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('suspends workspace when grace period has expired', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{ status: 'past_due', grace_period_ends_at: '2026-06-01T00:00:00.000Z' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const { suspendIfGraceExpired } = await import('./aiva-billing.js');
    const suspended = await suspendIfGraceExpired('ws-grace-1');

    expect(suspended).toBe(true);
    expect(poolQueryMock).toHaveBeenCalledTimes(2);
    expect(sendSuspendedEmailMock).toHaveBeenCalled();
  });

  it('does not suspend workspace still inside grace period', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ status: 'past_due', grace_period_ends_at: new Date(Date.now() + 86_400_000).toISOString() }],
    });

    const { suspendIfGraceExpired } = await import('./aiva-billing.js');
    const suspended = await suspendIfGraceExpired('ws-grace-2');

    expect(suspended).toBe(false);
    expect(sendSuspendedEmailMock).not.toHaveBeenCalled();
  });
});
