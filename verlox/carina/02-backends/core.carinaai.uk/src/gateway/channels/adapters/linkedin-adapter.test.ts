import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  LinkedInAdapter,
  parseLinkedInInbound,
  verifyLinkedInSignature,
} from './linkedin-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_PAYLOAD = {
  message: {
    id: 'msg-li-1',
    from: { person: 'urn:li:person:abc123' },
    content: { text: '/help please' },
    conversation: { id: 'urn:li:conversation:xyz789' },
  },
};

describe('LinkedInAdapter', () => {
  const credentials = {
    accessToken: 'li-access-token',
    webhookSecret: 'li-webhook-secret',
  };

  function adapter(): LinkedInAdapter {
    return new LinkedInAdapter(true, credentials.accessToken, credentials.webhookSecret);
  }

  afterEach(() => {
    mockFetch.mockReset();
  });

  it('parseInbound uses LinkedIn URN as externalUserId and marks DMs', () => {
    const message = parseLinkedInInbound(SAMPLE_PAYLOAD);

    expect(message?.channel).toBe('linkedin');
    expect(message?.externalUserId).toBe('urn:li:person:abc123');
    expect(message?.conversationId).toBe('urn:li:conversation:xyz789');
    expect(message?.isDirect).toBe(true);
    expect(message?.isMention).toBe(false);
    expect(message?.isCommand).toBe(true);
  });

  it('validateWebhook verifies X-LI-Signature HMAC', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const signature = crypto.createHmac('sha256', credentials.webhookSecret).update(rawBody).digest('hex');

    expect(verifyLinkedInSignature(rawBody, credentials.webhookSecret, signature)).toBe(true);
    expect(adapter().validateWebhook({
      headers: { 'x-li-signature': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook accepts sha256= prefixed signatures', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    const signature = crypto.createHmac('sha256', credentials.webhookSecret).update(rawBody).digest('hex');

    expect(adapter().validateWebhook({
      headers: { 'x-li-signature': `sha256=${signature}` },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with invalid signature', () => {
    const rawBody = JSON.stringify(SAMPLE_PAYLOAD);
    expect(adapter().validateWebhook({
      headers: { 'x-li-signature': 'invalid' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('sendMessage posts to LinkedIn messages API', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await adapter().sendMessage('urn:li:person:abc123', 'Hello');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.linkedin.com/v2/messages');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer li-access-token',
    });
    expect(JSON.parse(init.body as string)).toEqual({
      recipients: [{ person: 'urn:li:person:abc123' }],
      subject: '',
      body: 'Hello',
    });
  });
});
