import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  checkGroupMeRateLimit,
  GroupMeAdapter,
  parseGroupMeInbound,
  resetGroupMeRateLimit,
} from './groupme-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_PAYLOAD = {
  id: 'msg-1',
  name: 'Alice',
  user_id: 'user-42',
  group_id: 'group-99',
  text: '!status',
};

describe('GroupMeAdapter', () => {
  const credentials = {
    botId: 'bot-abc',
    botUserId: 'bot-user-7',
  };

  function adapter(): GroupMeAdapter {
    return new GroupMeAdapter(true, credentials.botId, credentials.botUserId);
  }

  afterEach(() => {
    mockFetch.mockReset();
    resetGroupMeRateLimit();
  });

  it('parseInbound skips bot echo messages', () => {
    expect(adapter().parseInbound({ ...SAMPLE_PAYLOAD, sender_type: 'bot' })).toBeNull();
  });

  it('parseInbound maps group fields and bang commands', () => {
    const message = parseGroupMeInbound(SAMPLE_PAYLOAD, credentials.botUserId);

    expect(message?.channel).toBe('groupme');
    expect(message?.id).toBe('msg-1');
    expect(message?.externalUserId).toBe('user-42');
    expect(message?.conversationId).toBe('group-99');
    expect(message?.isDirect).toBe(false);
    expect(message?.isCommand).toBe(true);
    expect(message?.senderName).toBe('Alice');
  });

  it('parseInbound detects mention attachments for the bot user id', () => {
    const message = parseGroupMeInbound({
      ...SAMPLE_PAYLOAD,
      text: 'hey bot',
      attachments: [{ type: 'mentions', user_ids: ['bot-user-7'] }],
    }, credentials.botUserId);

    expect(message?.isMention).toBe(true);
  });

  it('validateWebhook accepts unsigned payloads when enabled', () => {
    expect(adapter().validateWebhook({ headers: {}, body: SAMPLE_PAYLOAD })).toBe(true);
    expect(new GroupMeAdapter(false).validateWebhook({ headers: {}, body: SAMPLE_PAYLOAD })).toBe(false);
  });

  it('formatForChannel chunks at 450 characters', () => {
    const chunks = adapter().formatForChannel('x'.repeat(500));
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toHaveLength(450);
    expect(chunks[1]).toHaveLength(50);
  });

  it('sendMessage posts to GroupMe bot API without auth header', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await adapter().sendMessage('group-99', 'Hello group');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groupme.com/v3/bots/post');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({
      bot_id: 'bot-abc',
      text: 'Hello group',
    });
  });

  it('rate limits webhook posts by IP', () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 120; i += 1) {
      expect(checkGroupMeRateLimit(ip, 1_700_000_000_000)).toBe(true);
    }
    expect(checkGroupMeRateLimit(ip, 1_700_000_000_000)).toBe(false);
  });
});
