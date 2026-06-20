import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleMetaWebhookChallenge,
  parseMetaInbound,
  verifyMetaHubSignature,
} from './meta-graph-base.js';
import { MessengerAdapter } from './messenger-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_WEBHOOK = {
  object: 'page',
  entry: [
    {
      id: 'PAGE_ID',
      time: 1_700_000_000_000,
      messaging: [
        {
          sender: { id: 'USER_PSID_123' },
          recipient: { id: 'PAGE_ID' },
          timestamp: 1_700_000_000_000,
          message: {
            mid: 'mid.abc123',
            text: 'Hello Carina',
            attachments: [
              {
                type: 'image',
                payload: { url: 'https://example.com/photo.jpg' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('MessengerAdapter', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('parseInbound extracts sender ID, text, and attachments', () => {
    const adapter = new MessengerAdapter(true, 'page-token', 'verify-token', 'app-secret');
    const message = adapter.parseInbound(SAMPLE_WEBHOOK);

    expect(message?.channel).toBe('messenger');
    expect(message?.id).toBe('mid.abc123');
    expect(message?.externalUserId).toBe('USER_PSID_123');
    expect(message?.conversationId).toBe('USER_PSID_123');
    expect(message?.text).toBe('Hello Carina');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
    expect(message?.isCommand).toBe(false);
    expect(message?.attachments).toEqual([
      {
        contentType: 'image',
        url: 'https://example.com/photo.jpg',
      },
    ]);
  });

  it('parseInbound treats slash-prefixed text as a command', () => {
    const adapter = new MessengerAdapter(true, 'page-token', 'verify-token', 'app-secret');
    const payload = structuredClone(SAMPLE_WEBHOOK);
    payload.entry[0]!.messaging[0]!.message.text = '/help';

    const message = adapter.parseInbound(payload);
    expect(message?.text).toBe('/help');
    expect(message?.isCommand).toBe(true);
  });

  it('validateWebhook passes with correct HMAC signature', () => {
    const adapter = new MessengerAdapter(true, 'page-token', 'verify-token', 'app-secret');
    const rawBody = JSON.stringify(SAMPLE_WEBHOOK);
    const signature = `sha256=${crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex')}`;

    expect(adapter.validateWebhook({
      headers: { 'x-hub-signature-256': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with wrong signature', () => {
    const adapter = new MessengerAdapter(true, 'page-token', 'verify-token', 'app-secret');
    const rawBody = JSON.stringify(SAMPLE_WEBHOOK);

    expect(adapter.validateWebhook({
      headers: { 'x-hub-signature-256': 'sha256=deadbeef' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('GET challenge verification returns hub.challenge when verify_token matches', () => {
    const challenge = handleMetaWebhookChallenge({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token',
      'hub.challenge': 'challenge-string-123',
    }, 'verify-token');

    expect(challenge).toBe('challenge-string-123');
    expect(handleMetaWebhookChallenge({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'challenge-string-123',
    }, 'verify-token')).toBeNull();
  });

  it('sendMessage POSTs to Graph API with recipient and message body', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new MessengerAdapter(true, 'page-token', 'verify-token', 'app-secret');

    await adapter.sendMessage('USER_PSID_123', 'Reply text');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v20.0/me/messages?access_token=page-token');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { id: 'USER_PSID_123' },
      message: { text: 'Reply text' },
    });
  });

  it('parseMetaInbound returns null for invalid payloads', () => {
    expect(parseMetaInbound({}, 'messenger')).toBeNull();
    expect(parseMetaInbound({ entry: [] }, 'messenger')).toBeNull();
  });

  it('verifyMetaHubSignature rejects missing secret', () => {
    expect(verifyMetaHubSignature('{}', '', 'sha256=abc')).toBe(false);
  });
});
