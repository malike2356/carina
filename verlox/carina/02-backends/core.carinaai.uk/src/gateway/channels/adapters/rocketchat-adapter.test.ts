import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseRocketChatInbound,
  RocketChatAdapter,
  verifyRocketChatSignature,
} from './rocketchat-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_PAYLOAD = {
  _id: 'msg-abc',
  channel_id: 'CHANNEL_123',
  channel_name: 'general',
  user_id: 'USER_456',
  user_name: 'alice',
  text: '@carina what is the status?',
};

describe('RocketChatAdapter', () => {
  const credentials = {
    baseUrl: 'https://chat.example.com',
    botUserId: 'BOT_USER',
    botAuthToken: 'bot-token',
    webhookSecret: 'webhook-secret',
  };

  function adapter(secret = credentials.webhookSecret): RocketChatAdapter {
    return new RocketChatAdapter(
      true,
      credentials.baseUrl,
      credentials.botUserId,
      credentials.botAuthToken,
      secret,
    );
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('parseInbound extracts correct fields', () => {
    const message = adapter().parseInbound(SAMPLE_PAYLOAD);

    expect(message?.channel).toBe('rocketchat');
    expect(message?.id).toBe('msg-abc');
    expect(message?.externalUserId).toBe('USER_456');
    expect(message?.conversationId).toBe('CHANNEL_123');
    expect(message?.text).toBe('@carina what is the status?');
    expect(message?.isDirect).toBe(false);
    expect(message?.isMention).toBe(true);
    expect(message?.isCommand).toBe(false);
    expect(message?.senderName).toBe('alice');
  });

  it('parseInbound marks direct channels and commands', () => {
    const message = parseRocketChatInbound({
      ...SAMPLE_PAYLOAD,
      channel_name: 'direct',
      text: '/help',
    });

    expect(message?.isDirect).toBe(true);
    expect(message?.isCommand).toBe(true);
  });

  it('parseInbound skips bot echo messages', () => {
    expect(adapter().parseInbound({ ...SAMPLE_PAYLOAD, bot: true })).toBeNull();
  });

  it('validateWebhook passes with valid HMAC-SHA256 hex signature', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const signature = crypto.createHmac('sha256', credentials.webhookSecret).update(rawBody).digest('hex');

    expect(verifyRocketChatSignature(rawBody, credentials.webhookSecret, signature)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { 'x-rocketchat-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with invalid signature', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);

    expect(adapter().validateWebhook({
      headers: { 'x-rocketchat-signature': 'bad-signature' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('validateWebhook allows unsigned webhooks when secret is not configured', () => {
    expect(adapter('').validateWebhook({ headers: {}, body: SAMPLE_PAYLOAD })).toBe(true);
  });

  it('sendMessage posts to chat.postMessage with bot auth headers', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await adapter().sendMessage('CHANNEL_123', 'Hello team');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://chat.example.com/api/v1/chat.postMessage');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'X-Auth-Token': 'bot-token',
      'X-User-Id': 'BOT_USER',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      channel: 'CHANNEL_123',
      text: 'Hello team',
    });
  });
});
