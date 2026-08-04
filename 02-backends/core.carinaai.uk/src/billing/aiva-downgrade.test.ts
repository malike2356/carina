import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const pauseWorkerMock = vi.fn(async () => undefined);
const getSubscriptionStatusMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../workers/worker-store.js', () => ({
  pauseWorker: (...args: unknown[]) => pauseWorkerMock(...args),
}));

vi.mock('../workers/aiva-subscription-store.js', () => ({
  getSubscriptionStatus: (...args: unknown[]) => getSubscriptionStatusMock(...args),
}));

describe('resolveDowngradeConflict', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    pauseWorkerMock.mockClear();
    getSubscriptionStatusMock.mockReset();
    getSubscriptionStatusMock.mockResolvedValue({ aivasUsed: 3, planTier: 'starter', slotLimit: 1 });
  });

  it('pauses workers not selected and clears conflict flag', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ pending_downgrade_conflict: true, aiva_slot_limit: 1 }] })
      .mockResolvedValueOnce({
        rows: [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 });

    const { resolveDowngradeConflict } = await import('./aiva-downgrade.js');
    const result = await resolveDowngradeConflict('ws-1', ['w2']);

    expect(result.keptWorkerIds).toEqual(['w2']);
    expect(result.pausedWorkerIds).toEqual(expect.arrayContaining(['w1', 'w3']));
    expect(pauseWorkerMock).toHaveBeenCalledTimes(2);
  });

  it('rejects when selection count exceeds slot limit', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ pending_downgrade_conflict: true, aiva_slot_limit: 1 }],
    });

    const { resolveDowngradeConflict } = await import('./aiva-downgrade.js');
    await expect(resolveDowngradeConflict('ws-1', ['w1', 'w2'])).rejects.toThrow(/between 1 and 1/);
  });
});
