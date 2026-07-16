import { describe, expect, it, vi, beforeEach } from 'vitest';

const cancelStripeMock = vi.fn(async () => undefined);
const dismissWorkerMock = vi.fn(async () => undefined);
const sendDeletedEmailMock = vi.fn(async () => undefined);
const poolQueryMock = vi.fn(async () => ({ rowCount: 1 }));

vi.mock('../billing/aiva-billing-store.js', () => ({
  cancelAivaStripeSubscriptionForWorkspace: (...args: unknown[]) => cancelStripeMock(...args),
}));

vi.mock('../email/workspace-contact.js', () => ({
  getWorkspaceContact: vi.fn(async () => ({
    ownerEmail: 'owner@example.com',
    ownerName: 'Owner',
  })),
}));

vi.mock('../email/email-triggers.js', () => ({
  sendAccountDeletedEmail: (...args: unknown[]) => sendDeletedEmailMock(...args),
}));

vi.mock('../workers/worker-store.js', () => ({
  listWorkers: vi.fn(async () => [
    { id: 'w1', status: 'active', name: 'Aiva', roleDescription: '', channels: {}, createdAt: new Date() },
  ]),
  dismissWorker: (...args: unknown[]) => dismissWorkerMock(...args),
  listAutomations: vi.fn(async () => []),
}));

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

describe('eraseWorkspaceData', () => {
  beforeEach(() => {
    cancelStripeMock.mockClear();
    dismissWorkerMock.mockClear();
    sendDeletedEmailMock.mockClear();
    poolQueryMock.mockClear();
  });

  it('cancels Stripe subscription before clearing workspace PII', async () => {
    const { eraseWorkspaceData } = await import('./workspace-gdpr.js');
    await eraseWorkspaceData('ws-gdpr-1');

    expect(cancelStripeMock).toHaveBeenCalledWith('ws-gdpr-1');
    expect(sendDeletedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'ws-gdpr-1', email: 'owner@example.com' }),
    );
    expect(dismissWorkerMock).toHaveBeenCalledWith('ws-gdpr-1', 'w1');
    expect(poolQueryMock).toHaveBeenCalled();
  });
});
