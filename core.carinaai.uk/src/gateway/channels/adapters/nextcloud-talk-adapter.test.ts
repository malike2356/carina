import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NextcloudTalkAdapter,
  parseNextcloudTalkInbound,
  stripNextcloudHtml,
  verifyNextcloudTalkSignature,
} from './nextcloud-talk-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_PAYLOAD = {
  type: 'Create',
  actor: { id: 'user-1', name: 'Bob' },
  object: { id: 'msg-55', content: '<p>Hello <strong>@carina</strong></p>' },
  target: { id: 'room-token' },
};

describe('NextcloudTalkAdapter', () => {
  const credentials = {
    baseUrl: 'https://cloud.example.com',
    botSecret: 'talk-secret',
  };

  function adapter(): NextcloudTalkAdapter {
    return new NextcloudTalkAdapter(true, credentials.baseUrl, credentials.botSecret);
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('stripNextcloudHtml removes HTML tags', () => {
    expect(stripNextcloudHtml('<p>Hi &amp; bye</p>')).toBe('Hi &amp; bye');
  });

  it('parseInbound strips HTML and maps fields', () => {
    const message = parseNextcloudTalkInbound(SAMPLE_PAYLOAD);

    expect(message?.channel).toBe('nextcloud-talk');
    expect(message?.id).toBe('msg-55');
    expect(message?.externalUserId).toBe('user-1');
    expect(message?.conversationId).toBe('room-token');
    expect(message?.text).toBe('Hello @carina');
    expect(message?.isDirect).toBe(false);
    expect(message?.isMention).toBe(true);
    expect(message?.senderName).toBe('Bob');
  });

  it('parseInbound ignores non-Create events', () => {
    expect(parseNextcloudTalkInbound({ ...SAMPLE_PAYLOAD, type: 'Delete' })).toBeNull();
  });

  it('validateWebhook verifies HMAC-SHA256 hex signature', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const signature = crypto.createHmac('sha256', credentials.botSecret).update(rawBody).digest('hex');

    expect(verifyNextcloudTalkSignature(rawBody, credentials.botSecret, signature)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { 'x-nextcloud-talk-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with invalid signature', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    expect(adapter().validateWebhook({
      headers: { 'x-nextcloud-talk-signature': 'bad' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('sendMessage posts to Nextcloud Talk chat API', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await adapter().sendMessage('room-token', 'Reply text');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://cloud.example.com/ocs/v2.php/apps/spreed/api/v1/chat/room-token');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer talk-secret',
      'OCS-APIRequest': 'true',
      Accept: 'application/json',
    });
    expect(JSON.parse(init.body as string)).toEqual({ message: 'Reply text', replyTo: 0 });
  });
});
