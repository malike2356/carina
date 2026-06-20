import { describe, expect, it } from 'vitest';
import { DiscordAdapter } from './discord-adapter.js';

describe('DiscordAdapter', () => {
  it('normalizes mentioned server messages into ChannelMessage', () => {
    const adapter = new DiscordAdapter(true);

    const message = adapter.parseInbound({
      id: 'm1',
      guildId: 'g1',
      channelId: 'c1',
      author: { id: 'u1' },
      content: '@Carina hello',
      createdTimestamp: 1_700_000_000_000,
    });

    expect(message?.channel).toBe('discord');
    expect(message?.externalUserId).toBe('u1');
    expect(message?.isMention).toBe(true);
  });

  it('ignores unmentioned server chatter', () => {
    const adapter = new DiscordAdapter(true);

    const message = adapter.parseInbound({
      id: 'm1',
      guildId: 'g1',
      channelId: 'c1',
      author: { id: 'u1' },
      content: 'hello everyone',
    });

    expect(message).toBeNull();
  });

  it('wraps URLs and splits to Discord limits', () => {
    const adapter = new DiscordAdapter(true);
    const chunks = adapter.formatForChannel(`${'a'.repeat(1995)} https://example.com`);

    expect(chunks.every((chunk) => chunk.length <= 2000)).toBe(true);
    expect(chunks.join(' ')).toContain('<https://example.com>');
  });

  it('rejects unsigned webhook requests', () => {
    const adapter = new DiscordAdapter(true);

    expect(adapter.validateWebhook({ headers: {}, body: {} })).toBe(false);
  });
});
