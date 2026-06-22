import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindSessionDelivery, getSessionDelivery } from '../agents/cron-delivery-registry.js';
import { ChannelDocking } from './channel-docking.js';
import {
  clearSessionIdentityForTests,
  ensureSessionIdentity,
} from './session-identity-prefs.js';

const resolveToChannel = vi.fn();
const getIdentities = vi.fn();

vi.mock('./identity-resolver.js', () => ({
  getIdentityResolver: () => ({
    resolveToChannel,
    getIdentities,
  }),
}));

vi.mock('./channels/channel-registry.js', () => ({
  channelRegistry: {
    getByName: () => null,
  },
}));

afterEach(() => {
  clearSessionIdentityForTests();
  resolveToChannel.mockReset();
  getIdentities.mockReset();
});

describe('ChannelDocking', () => {
  const docking = new ChannelDocking();

  it('docks reply delivery to a linked channel', async () => {
    ensureSessionIdentity('sess-dock', 'usr_1', {
      channel: 'telegram',
      conversationId: 'tg-chat',
    });
    bindSessionDelivery('sess-dock', {
      channel: 'telegram',
      conversationId: 'tg-chat',
    });

    resolveToChannel.mockResolvedValue({
      channel: 'web',
      channelUserId: 'web-user',
    });

    const result = await docking.dock('sess-dock', 'usr_1', 'web');
    expect(result).toEqual({
      success: true,
      dockedTo: 'web',
      dockedFrom: 'telegram',
    });
    expect(getSessionDelivery('sess-dock')).toEqual({
      channel: 'web',
      conversationId: 'web-user',
      threadId: undefined,
    });
  });

  it('undocks back to the original channel', async () => {
    ensureSessionIdentity('sess-undock', 'usr_2', {
      channel: 'telegram',
      conversationId: 'tg-chat',
    });
    bindSessionDelivery('sess-undock', {
      channel: 'web',
      conversationId: 'web-user',
    });
    const state = ensureSessionIdentity('sess-undock', 'usr_2', {
      channel: 'web',
      conversationId: 'web-user',
    });
    state.dockedFrom = 'telegram';
    state.replyChannel = 'web';
    state.replyConversationId = 'web-user';

    resolveToChannel.mockResolvedValue({
      channel: 'telegram',
      channelUserId: 'tg-chat',
    });

    const result = await docking.undock('sess-undock');
    expect(result.success).toBe(true);
    expect(getSessionDelivery('sess-undock')?.channel).toBe('telegram');
  });

  it('rejects dock when target channel is not linked', async () => {
    ensureSessionIdentity('sess-miss', 'usr_3', {
      channel: 'telegram',
      conversationId: 'tg-chat',
    });
    resolveToChannel.mockResolvedValue(null);

    const result = await docking.dock('sess-miss', 'usr_3', 'discord');
    expect(result).toEqual({
      success: false,
      error: 'No linked identity on discord. Use /link first.',
    });
  });
});
