import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMetaWebhookChallenge } from './meta-graph-base.js';
import { InstagramAdapter } from './instagram-adapter.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const SAMPLE_WEBHOOK = {
  object: 'instagram',
  entry: [
    {
      id: 'IG_ACCOUNT_ID',
      time: 1_700_000_000_000,
      messaging: [
        {
          sender: { id: 'IG_SCOPED_USER_456' },
          recipient: { id: 'IG_ACCOUNT_ID' },
          timestamp: 1_700_000_000_000,
          message: {
            mid: 'mid.ig789',
            text: 'DM on Instagram',
            attachments: [
              {
                type: 'video',
                payload: { url: 'https://example.com/clip.mp4' },
              },
            ],
          },
        },
      ],
    },
  ],
};

describe('InstagramAdapter', () => {
  afterEach(() => {
    mockFetch.mockReset();
  });

  it('parseInbound extracts Instagram-scoped sender ID, text, and attachments', () => {
    const adapter = new InstagramAdapter(true, 'ig-token', 'verify-token', 'app-secret');
    const message = adapter.parseInbound(SAMPLE_WEBHOOK);

    expect(message?.channel).toBe('instagram');
    expect(message?.id).toBe('mid.ig789');
    expect(message?.externalUserId).toBe('IG_SCOPED_USER_456');
    expect(message?.conversationId).toBe('IG_SCOPED_USER_456');
    expect(message?.text).toBe('DM on Instagram');
    expect(message?.isDirect).toBe(true);
    expect(message?.attachments).toEqual([
      {
        contentType: 'video',
        url: 'https://example.com/clip.mp4',
      },
    ]);
  });

  it('validateWebhook passes with correct HMAC signature', () => {
    const adapter = new InstagramAdapter(true, 'ig-token', 'verify-token', 'app-secret');
    const rawBody = JSON.stringify(SAMPLE_WEBHOOK);
    const signature = `sha256=${crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex')}`;

    expect(adapter.validateWebhook({
      headers: { 'x-hub-signature-256': signature },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(true);
  });

  it('validateWebhook fails with wrong signature', () => {
    const adapter = new InstagramAdapter(true, 'ig-token', 'verify-token', 'app-secret');
    const rawBody = JSON.stringify(SAMPLE_WEBHOOK);

    expect(adapter.validateWebhook({
      headers: { 'x-hub-signature-256': 'sha256=bad' },
      body: JSON.parse(rawBody),
      rawBody,
    })).toBe(false);
  });

  it('GET challenge verification returns hub.challenge when verify_token matches', () => {
    const challenge = handleMetaWebhookChallenge({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'ig-verify',
      'hub.challenge': 'ig-challenge-999',
    }, 'ig-verify');

    expect(challenge).toBe('ig-challenge-999');
  });

  it('sendMessage POSTs to Graph API with Instagram access token', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    const adapter = new InstagramAdapter(true, 'ig-token', 'verify-token', 'app-secret');

    await adapter.sendMessage('IG_SCOPED_USER_456', 'Instagram reply');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://graph.facebook.com/v20.0/me/messages?access_token=ig-token');
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { id: 'IG_SCOPED_USER_456' },
      message: { text: 'Instagram reply' },
    });
  });

  it('checkConfigured returns false when credentials are missing', () => {
    expect(new InstagramAdapter(true, '', 'verify', 'secret').checkConfigured()).toBe(false);
    expect(new InstagramAdapter(true, 'token', '', 'secret').checkConfigured()).toBe(false);
    expect(new InstagramAdapter(true, 'token', 'verify', '').checkConfigured()).toBe(false);
  });
});
