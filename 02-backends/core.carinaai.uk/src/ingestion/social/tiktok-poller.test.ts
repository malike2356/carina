import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../channels/channel-store.js', () => ({
  listSocialChannelsForRefresh: vi.fn(),
  getWorkerChannelByWorkerAndChannel: vi.fn(),
  mergeWorkerChannelCredentials: vi.fn(),
  readChannelCredentials: vi.fn(),
}));

vi.mock('../../channels/message-router.js', () => ({
  handleParsedInbound: vi.fn(),
}));

vi.mock('./tiktok-messaging.js', () => ({
  fetchTikTokInboundSince: vi.fn(),
  parseTikTokPollMessage: vi.fn(),
}));

vi.mock('../../workers/aiva-message-handler.js', () => ({
  isAiWorkersEnabled: vi.fn(() => true),
}));

describe('tiktok-poller', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('pollTikTokChannel skips when webhook is registered', async () => {
    const { readChannelCredentials } = await import('../../channels/channel-store.js');
    const { fetchTikTokInboundSince } = await import('./tiktok-messaging.js');
    const { pollTikTokChannel } = await import('./tiktok-poller.js');

    vi.mocked(readChannelCredentials).mockReturnValue({ webhook_registered: 'true' });
    const processed = await pollTikTokChannel({
      id: 'ch-1',
      workerId: 'worker-1',
      workspaceId: 'ws-1',
      channel: 'tiktok',
      identifier: 'open-1',
      credentials: { encrypted: 'blob' },
      enabled: true,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(processed).toBe(0);
    expect(fetchTikTokInboundSince).not.toHaveBeenCalled();
  });

  it('pollTikTokChannel processes inbound and updates last_polled_at', async () => {
    const channelStore = await import('../../channels/channel-store.js');
    const messaging = await import('./tiktok-messaging.js');
    const router = await import('../../channels/message-router.js');
    const { pollTikTokChannel } = await import('./tiktok-poller.js');

    vi.mocked(channelStore.readChannelCredentials).mockReturnValue({
      access_token: 'token',
      open_id: 'biz-1',
      last_polled_at: '2026-01-01T00:00:00.000Z',
    });
    vi.mocked(messaging.fetchTikTokInboundSince).mockResolvedValue([
      {
        conversationId: 'conv-1',
        contactId: 'user-1',
        text: 'Hello',
        messageId: 'msg-1',
        timestamp: new Date('2026-01-02T00:00:00.000Z'),
      },
    ]);
    vi.mocked(messaging.parseTikTokPollMessage).mockReturnValue({
      channel: 'tiktok',
      workerId: 'worker-1',
      workspaceId: 'ws-1',
      contactId: 'user-1',
      conversationId: 'conv-1',
      content: 'Hello',
      rawPayload: {},
      timestamp: new Date(),
      threadId: 'msg-1',
    });

    const processed = await pollTikTokChannel({
      id: 'ch-1',
      workerId: 'worker-1',
      workspaceId: 'ws-1',
      channel: 'tiktok',
      identifier: 'open-1',
      credentials: { encrypted: 'blob' },
      enabled: true,
      verified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(processed).toBe(1);
    expect(router.handleParsedInbound).toHaveBeenCalledOnce();
    expect(channelStore.mergeWorkerChannelCredentials).toHaveBeenCalledWith(
      'worker-1',
      'tiktok',
      expect.objectContaining({ last_polled_at: expect.any(String) }),
    );
  });
});
