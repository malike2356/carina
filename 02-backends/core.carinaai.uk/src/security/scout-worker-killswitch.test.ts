import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../ingestion/email/worker-approval-store.js', () => ({
  queueWorkerTrigger: vi.fn(async () => undefined),
  consumePendingTriggers: vi.fn(async () => []),
}));

describe('scout-worker-killswitch social queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues social trigger when worker suspended', async () => {
    const { queueSocialTriggerForWorker } = await import('./scout-worker-killswitch.js');
    const { queueWorkerTrigger } = await import('../ingestion/email/worker-approval-store.js');

    await queueSocialTriggerForWorker({
      workerId: 'worker-1',
      workspaceId: 'ws-1',
      channel: 'linkedin',
      contactId: 'user-1',
      inboundText: 'Hello',
      draftText: 'Hi there',
    });

    expect(queueWorkerTrigger).toHaveBeenCalledWith(expect.objectContaining({
      triggerType: 'social',
      triggerDetail: expect.objectContaining({
        channel: 'linkedin',
        draftText: 'Hi there',
      }),
    }));
  });
});
