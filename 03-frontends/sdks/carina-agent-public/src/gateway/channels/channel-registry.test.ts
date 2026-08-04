import { describe, expect, it } from 'vitest';
import { ChannelRegistry } from './channel-registry.js';
import { DiscordAdapter } from './adapters/discord-adapter.js';
import { SmsAdapter } from './adapters/sms-adapter.js';

describe('ChannelRegistry', () => {
  it('registers, looks up, and lists active adapters', () => {
    const registry = new ChannelRegistry();
    const discord = new DiscordAdapter(true);
    const sms = new SmsAdapter(false);

    registry.register(discord);
    registry.register(sms);

    expect(registry.getByName('discord')).toBe(discord);
    expect(registry.getByName('sms')).toBe(sms);
    expect(registry.listActive()).toEqual(['discord']);
  });

  it('routes a raw Discord payload to the Discord adapter', async () => {
    const registry = new ChannelRegistry();
    registry.register(new DiscordAdapter(true));

    const message = await registry.getForInbound('discord', {
      id: 'm1',
      channelId: 'c1',
      author: { id: 'u1' },
      content: '@Carina hello',
    });

    expect(message?.channel).toBe('discord');
    expect(message?.text).toBe('@Carina hello');
  });

  it('routes a Twilio webhook payload to the SMS adapter', async () => {
    const registry = new ChannelRegistry();
    registry.register(new SmsAdapter(true));

    const message = await registry.getForInbound('sms', {
      MessageSid: 'sms1',
      From: '+15551234567',
      Body: 'hello',
    });

    expect(message?.channel).toBe('sms');
    expect(message?.conversationId).toBe('+15551234567');
  });
});
