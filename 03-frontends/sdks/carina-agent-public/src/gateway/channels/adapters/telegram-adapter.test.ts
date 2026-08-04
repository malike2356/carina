import { describe, expect, it } from 'vitest';
import { TelegramAdapter } from './telegram-adapter.js';

describe('TelegramAdapter', () => {
  it('normalizes Telegram messages into ChannelMessage', () => {
    const adapter = new TelegramAdapter(true);

    const message = adapter.parseInbound({
      message_id: 10,
      date: 1_700_000_000,
      text: '/help',
      from: { id: 42 },
      chat: { id: 99, type: 'private' },
    });

    expect(message?.channel).toBe('telegram');
    expect(message?.externalUserId).toBe('42');
    expect(message?.isCommand).toBe(true);
  });

  it('formats messages to Telegram length limits', () => {
    const adapter = new TelegramAdapter(true);
    const chunks = adapter.formatForChannel('t'.repeat(4100));

    expect(chunks).toHaveLength(2);
    expect(chunks[0].length).toBe(4096);
  });

  it('rejects webhook validation when disabled', () => {
    const adapter = new TelegramAdapter(false);

    expect(adapter.validateWebhook()).toBe(false);
  });
});
