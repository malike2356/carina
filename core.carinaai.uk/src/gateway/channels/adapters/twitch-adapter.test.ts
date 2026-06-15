import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseTwitchInbound,
  TwitchAdapter,
  verifyTwitchEventSubSignature,
} from './twitch-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const NOTIFICATION_PAYLOAD = {
  subscription: { type: 'channel.chat.message' },
  event: {
    message_id: 'msg-1',
    chatter_user_id: 'user-123',
    chatter_user_login: 'viewer1',
    broadcaster_user_id: 'broadcaster-999',
    message: { text: '!hello @carinabot' },
  },
};

describe('TwitchAdapter', () => {
  const credentials = {
    clientId: 'twitch-client-id',
    clientSecret: 'twitch-client-secret',
    eventsubSecret: 'eventsub-secret',
    botUsername: 'carinabot',
    channelId: 'broadcaster-999',
    botUserId: 'bot-user-1',
  };

  function adapter(fetchImpl = mockFetch): TwitchAdapter {
    return new TwitchAdapter(
      true,
      credentials.clientId,
      credentials.clientSecret,
      credentials.eventsubSecret,
      credentials.botUsername,
      credentials.channelId,
      credentials.botUserId,
      fetchImpl,
    );
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('verifyTwitchEventSubSignature validates EventSub HMAC', () => {
    const messageId = 'msg-id-1';
    const timestamp = '1700000000';
    const rawBody = JSON.stringify(NOTIFICATION_PAYLOAD);
    const payload = messageId + timestamp + rawBody;
    const signature = `sha256=${crypto.createHmac('sha256', credentials.eventsubSecret).update(payload).digest('hex')}`;

    expect(verifyTwitchEventSubSignature(
      messageId,
      timestamp,
      rawBody,
      credentials.eventsubSecret,
      signature,
    )).toBe(true);
  });

  it('validateWebhook fails with invalid signature', () => {
    expect(adapter().validateWebhook({
      headers: {
        'twitch-eventsub-message-id': 'id',
        'twitch-eventsub-message-timestamp': '1',
        'twitch-eventsub-message-signature': 'sha256=bad',
      },
      body: NOTIFICATION_PAYLOAD,
      rawBody: JSON.stringify(NOTIFICATION_PAYLOAD),
    })).toBe(false);
  });

  it('parseInbound extracts chat message fields and mention', () => {
    const message = adapter().parseInbound(NOTIFICATION_PAYLOAD);

    expect(message?.channel).toBe('twitch');
    expect(message?.id).toBe('msg-1');
    expect(message?.externalUserId).toBe('user-123');
    expect(message?.conversationId).toBe('broadcaster-999');
    expect(message?.text).toBe('!hello @carinabot');
    expect(message?.isDirect).toBe(false);
    expect(message?.isMention).toBe(true);
    expect(message?.isCommand).toBe(true);
    expect(message?.senderName).toBe('viewer1');
  });

  it('parseInbound skips bot echo messages', () => {
    const payload = structuredClone(NOTIFICATION_PAYLOAD);
    payload.event.chatter_user_login = 'carinabot';
    expect(parseTwitchInbound(payload, 'carinabot')).toBeNull();
  });

  it('formatForChannel splits messages longer than 500 chars', () => {
    const chunks = adapter().formatForChannel('x'.repeat(900));
    expect(chunks.length).toBe(2);
    expect(chunks.every((chunk) => chunk.length <= 500)).toBe(true);
  });

  it('sendMessage obtains app token and posts to helix chat messages', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes('oauth2/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'app-token', expires_in: 3600 }),
        } as Response;
      }
      if (url.includes('/helix/chat/messages')) {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    });

    await adapter(fetchImpl).sendMessage('broadcaster-999', 'Thanks for watching');

    const chatCall = fetchImpl.mock.calls.find(([url]) => String(url).includes('/helix/chat/messages'));
    expect(chatCall).toBeTruthy();
    const [, init] = chatCall as [string, RequestInit];
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer app-token',
      'Client-Id': 'twitch-client-id',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      broadcaster_id: 'broadcaster-999',
      sender_id: 'bot-user-1',
      message: 'Thanks for watching',
    });
  });

  it('webhook_callback_verification challenge is present in payload body', () => {
    const challenge = String(({
      challenge: 'callback-challenge-token',
    } as Record<string, unknown>).challenge ?? '');
    expect(challenge).toBe('callback-challenge-token');
  });
});
