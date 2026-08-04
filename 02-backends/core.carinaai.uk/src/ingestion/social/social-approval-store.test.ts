import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./social-approval-store.js', () => ({
  getSocialApproval: vi.fn(async () => ({
    id: 'approval-1',
    workerId: 'worker-1',
    workspaceId: 'ws-1',
    channel: 'linkedin',
    contactId: 'user-1',
    conversationId: 'conv-1',
    inboundText: 'Hi',
    draftText: 'Hello',
    platformMessageId: null,
    status: 'pending',
    requestedAt: new Date(),
    timeoutAt: new Date(Date.now() + 86_400_000),
    decisionBy: null,
  })),
  resolveSocialApproval: vi.fn(async () => ({
    id: 'approval-1',
    workerId: 'worker-1',
    workspaceId: 'ws-1',
    channel: 'linkedin',
    contactId: 'user-1',
    conversationId: 'conv-1',
    inboundText: 'Hi',
    draftText: 'Hello',
    platformMessageId: null,
    status: 'approved',
    requestedAt: new Date(),
    timeoutAt: new Date(Date.now() + 86_400_000),
    decisionBy: 'owner',
  })),
  updateSocialApprovalDraft: vi.fn(async () => null),
  markSocialApprovalSent: vi.fn(async () => undefined),
}));

vi.mock('../../channels/channel-store.js', () => ({
  getWorkerChannelByWorkerAndChannel: vi.fn(async () => ({
    id: 'row-1',
    credentials: { encrypted: 'blob' },
  })),
  markChannelVerified: vi.fn(async () => undefined),
}));

vi.mock('../../channels/outbound-reply.js', () => ({
  sendOutboundReply: vi.fn(async () => undefined),
}));

vi.mock('../../workers/worker-store.js', () => ({
  logActivity: vi.fn(async () => undefined),
}));

vi.mock('../../security/scout-event-queue.js', () => ({
  reportAivaScoutEvent: vi.fn(async () => undefined),
}));

describe('social-send-on-approve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('approve triggers platform send mock', async () => {
    const { approveSocialApproval } = await import('./social-send-on-approve.js');
    const { sendOutboundReply } = await import('../../channels/outbound-reply.js');

    const result = await approveSocialApproval({
      workspaceId: 'ws-1',
      approvalId: 'approval-1',
      decisionBy: 'owner',
    });

    expect(result?.status).toBe('sent');
    expect(sendOutboundReply).toHaveBeenCalledOnce();
  });
});
