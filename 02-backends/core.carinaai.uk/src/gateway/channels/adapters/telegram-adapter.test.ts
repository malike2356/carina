import { describe, expect, it, vi } from 'vitest';
import {
  parseTelegramForumContext,
  TelegramAdapter,
  topicId,
} from './telegram-adapter.js';

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
    expect(message?.threadId).toBeUndefined();
  });

  it('parseInbound sets threadId when message has message_thread_id in a forum', () => {
    const adapter = new TelegramAdapter(true, undefined, 'carinabot');

    const message = adapter.parseInbound({
      message_id: 11,
      date: 1_700_000_000,
      text: 'topic message',
      message_thread_id: 77,
      from: { id: 42, first_name: 'Ada' },
      chat: { id: -100123, type: 'supergroup', is_forum: true, title: 'Carina Forum' },
    });

    expect(message?.threadId).toBe('77');
    expect(message?.chatType).toBe('group');
    expect(message?.chatTitle).toBe('Carina Forum');
    expect(message?.isDirect).toBe(false);
  });

  it('parseInbound returns undefined threadId for non-forum messages', () => {
    const adapter = new TelegramAdapter(true);

    const groupMessage = adapter.parseInbound({
      message_id: 12,
      date: 1_700_000_000,
      text: 'plain group chat',
      from: { id: 42 },
      chat: { id: -100456, type: 'supergroup' },
    });
    expect(groupMessage?.threadId).toBeUndefined();

    const threadWithoutForum = adapter.parseInbound({
      message_id: 13,
      date: 1_700_000_000,
      text: 'orphan thread id',
      message_thread_id: 5,
      from: { id: 42 },
      chat: { id: -100456, type: 'supergroup', is_forum: false },
    });
    expect(threadWithoutForum?.threadId).toBeUndefined();
  });

  it('sendMessage includes message_thread_id when options.threadId is set', async () => {
    const sendMessage = vi.fn(async () => ({}));
    const adapter = new TelegramAdapter(true, { sendMessage }, 'carinabot');

    await adapter.sendMessage('-100123', 'reply in topic', { threadId: '77' });

    expect(sendMessage).toHaveBeenCalledWith(
      -100123,
      'reply in topic',
      expect.objectContaining({
        message_thread_id: 77,
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: true },
      }),
    );
  });

  it('parseTelegramForumContext extracts chatId and topicId', () => {
    const raw = {
      message_id: 20,
      message_thread_id: 88,
      chat: { id: -100999, type: 'supergroup', is_forum: true, title: 'Ops' },
      forum_topic_created: { name: 'Deployments' },
      text: 'topic start',
      from: { id: 1 },
    };

    expect(parseTelegramForumContext(raw)).toEqual({
      chatId: '-100999',
      topicId: '88',
      topicName: 'Deployments',
    });
    expect(topicId(raw)).toBe('88');
  });

  it('detects @mention entity in forum messages', () => {
    const adapter = new TelegramAdapter(true, undefined, 'carinabot');

    const message = adapter.parseInbound({
      message_id: 21,
      date: 1_700_000_000,
      text: 'hey @carinabot can you help?',
      message_thread_id: 3,
      entities: [{ type: 'mention', offset: 4, length: 10 }],
      from: { id: 42, username: 'viewer' },
      chat: { id: -100123, type: 'supergroup', is_forum: true, title: 'Forum' },
    });

    expect(message?.isMention).toBe(true);
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
