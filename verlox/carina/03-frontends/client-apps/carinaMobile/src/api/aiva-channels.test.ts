import { describe, expect, it } from 'vitest';
import {
  buildConnectChannelPayload,
  catalogChannelsForConnect,
  connectedChannels,
  parseAivaChannelsList,
  validateConnectChannelValues,
} from './aiva-channels';

describe('aiva channel helpers', () => {
  it('validates required credentials and trims payload values', () => {
    expect(validateConnectChannelValues('telegram', {})).toBe('Bot token is required.');
    expect(buildConnectChannelPayload('worker-1', 'telegram', {
      bot_token: ' token ',
      identifier: ' support ',
    })).toEqual({
      workerId: 'worker-1',
      channel: 'telegram',
      credentials: { bot_token: 'token' },
      identifier: 'support',
    });
  });

  it('separates connected channels from available mobile channels', () => {
    const { channels, connectedCount } = parseAivaChannelsList({
      channels: [
        { id: 'telegram', type: 'telegram', connected: false },
        { id: 'email', type: 'email', connectionStatus: 'oauth_pending' },
        { id: 'custom', type: 'custom', connected: false },
      ],
    });

    expect(connectedCount).toBe(0);
    expect(catalogChannelsForConnect(channels).map((item) => item.id)).toEqual(['telegram']);
    expect(connectedChannels(channels).map((item) => item.id)).toEqual(['email']);
  });
});
