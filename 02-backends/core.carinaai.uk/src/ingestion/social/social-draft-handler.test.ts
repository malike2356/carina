import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./social-approval-store.js', () => ({
  createSocialApproval: vi.fn(async () => ({
    id: 'approval-1',
    workerId: 'worker-1',
    workspaceId: 'ws-1',
    channel: 'linkedin',
    contactId: 'user-1',
    conversationId: null,
    inboundText: 'Hi',
    draftText: 'Hello back',
    platformMessageId: null,
    status: 'pending',
    requestedAt: new Date(),
    timeoutAt: new Date(Date.now() + 86_400_000),
    decisionBy: null,
  })),
}));

vi.mock('./social-settings-store.js', () => ({
  getSocialSettings: vi.fn(async () => ({
    socialRequireApproval: true,
    socialAutoReplyEnabled: false,
    socialAutoReplyAllowlist: ['thanks'],
  })),
}));

vi.mock('./social-send-on-approve.js', () => ({
  sendSocialReply: vi.fn(async () => undefined),
}));

vi.mock('../../workers/worker-store.js', () => ({
  getWorker: vi.fn(async () => ({
    id: 'worker-1',
    workspaceId: 'ws-1',
    status: 'active',
  })),
  logActivity: vi.fn(async () => undefined),
}));

vi.mock('../../security/scout-event-queue.js', () => ({
  reportAivaScoutEvent: vi.fn(async () => undefined),
}));

vi.mock('../../security/scout-worker-killswitch.js', () => ({
  isWorkerExecutionBlocked: vi.fn(() => false),
  queueSocialTriggerForWorker: vi.fn(async () => undefined),
}));

vi.mock('../../channels/channel-store.js', () => ({
  markChannelVerified: vi.fn(async () => undefined),
}));

describe('social-draft-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates pending approval instead of sending', async () => {
    const { handleSocialInboundReply } = await import('./social-draft-handler.js');
    const { createSocialApproval } = await import('./social-approval-store.js');
    const { sendSocialReply } = await import('./social-send-on-approve.js');

    const result = await handleSocialInboundReply({
      message: {
        channel: 'linkedin',
        workerId: 'worker-1',
        workspaceId: 'ws-1',
        contactId: 'user-1',
        content: 'Need help',
        rawPayload: {},
        timestamp: new Date().toISOString(),
        threadId: 'user-1',
      },
      entry: {
        workerId: 'worker-1',
        workspaceId: 'ws-1',
        channelRowId: 'row-1',
        credentialBlob: 'blob',
      },
      draftText: 'Happy to help with that.',
    });

    expect(result.sent).toBe(false);
    expect(result.approvalId).toBe('approval-1');
    expect(createSocialApproval).toHaveBeenCalledOnce();
    expect(sendSocialReply).not.toHaveBeenCalled();
  });
});
