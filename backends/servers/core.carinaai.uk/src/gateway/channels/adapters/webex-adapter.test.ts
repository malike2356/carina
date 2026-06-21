import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  parseWebexMessage,
  verifyWebexSignature,
  WebexAdapter,
} from './webex-adapter.js';

const WEBHOOK_EVENT = {
  id: 'evt-1',
  resource: 'messages',
  event: 'created',
  data: { id: 'MESSAGE_123' },
};

const MESSAGE_PAYLOAD = {
  id: 'MESSAGE_123',
  roomId: 'ROOM_789',
  roomType: 'direct',
  text: '@Carina please summarize',
  personId: 'PERSON_USER',
  mentionedPeople: ['BOT_PERSON_ID'],
};

describe('WebexAdapter', () => {
  const credentials = {
    botToken: 'webex-bot-token',
    webhookSecret: 'webex-webhook-secret',
  };

  function mockFetch(message = MESSAGE_PAYLOAD): typeof fetch {
    return vi.fn(async (url: string) => {
      if (url.includes('/people/me')) {
        return {
          ok: true,
          json: async () => ({ id: 'BOT_PERSON_ID', displayName: 'Carina' }),
        } as Response;
      }
      if (url.includes('/messages/MESSAGE_123')) {
        return {
          ok: true,
          json: async () => message,
        } as Response;
      }
      if (url === 'https://webexapis.com/v1/messages') {
        return { ok: true, json: async () => ({}) } as Response;
      }
      return { ok: false, json: async () => ({}) } as Response;
    }) as typeof fetch;
  }

  function adapter(fetchImpl = mockFetch()): WebexAdapter {
    return new WebexAdapter(true, credentials.botToken, credentials.webhookSecret, fetchImpl);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parseInbound extracts message fields after fetching from Webex API', async () => {
    const message = await adapter().parseWebhookEvent(WEBHOOK_EVENT);

    expect(message?.channel).toBe('webex');
    expect(message?.id).toBe('MESSAGE_123');
    expect(message?.externalUserId).toBe('PERSON_USER');
    expect(message?.conversationId).toBe('ROOM_789');
    expect(message?.text).toBe('please summarize');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(true);
    expect(message?.isCommand).toBe(false);
  });

  it('parseInbound skips bot echo messages', async () => {
    expect(parseWebexMessage(
      { ...MESSAGE_PAYLOAD, personId: 'BOT_PERSON_ID' },
      'BOT_PERSON_ID',
      'Carina',
    )).toBeNull();

    const fetchImpl = mockFetch({ ...MESSAGE_PAYLOAD, personId: 'BOT_PERSON_ID' });
    expect(await adapter(fetchImpl).parseWebhookEvent(WEBHOOK_EVENT)).toBeNull();
  });

  it('parseInbound returns null for non-message events', async () => {
    expect(await adapter().parseWebhookEvent({
      resource: 'rooms',
      event: 'created',
      data: { id: 'ROOM_1' },
    })).toBeNull();
  });

  it('validateWebhook passes with valid X-Spark-Signature', () => {
    const rawBody = JSON.stringify(WEBHOOK_EVENT);
    const signature = crypto.createHmac('sha1', credentials.webhookSecret).update(rawBody).digest('base64');

    expect(verifyWebexSignature(rawBody, credentials.webhookSecret, signature)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { 'x-spark-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with invalid signature', () => {
    const rawBody = JSON.stringify(WEBHOOK_EVENT);

    expect(adapter().validateWebhook({
      headers: { 'x-spark-signature': 'invalid' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('sendMessage posts to Webex messages API with bearer token', async () => {
    const fetchImpl = mockFetch();
    await adapter(fetchImpl).sendMessage('ROOM_789', 'Reply from Carina');

    const postCall = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls.find(
      ([url]) => url === 'https://webexapis.com/v1/messages',
    ) as [string, RequestInit] | undefined;

    expect(postCall).toBeTruthy();
    const [, init] = postCall!;
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer webex-bot-token',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      roomId: 'ROOM_789',
      text: 'Reply from Carina',
    });
  });

  it('formatForChannel splits messages longer than 7439 chars', () => {
    const chunks = adapter().formatForChannel('x'.repeat(10_000));
    expect(chunks.length).toBe(2);
    expect(chunks.every((chunk) => chunk.length <= 7439)).toBe(true);
  });
});
