import crypto from 'crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  handleMetaWorkerWebhookChallenge,
  instagramWorkerAdapter,
  messengerWorkerAdapter,
} from './meta-worker-adapter.js';

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
          },
        },
      ],
    },
  ],
};

describe('meta-worker-adapter', () => {
  const credentials = {
    page_access_token: 'page-token',
    verify_token: 'verify-token',
    page_id: 'PAGE_ID',
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.META_APP_SECRET;
  });

  it('instagram parse maps Meta payload to InboundMessage', () => {
    const message = instagramWorkerAdapter.parse(SAMPLE_WEBHOOK, 'worker-1', 'workspace-1');
    expect(message?.channel).toBe('instagram');
    expect(message?.contactId).toBe('USER_PSID_123');
    expect(message?.content).toBe('Hello Carina');
  });

  it('messenger parse maps Meta payload to InboundMessage', () => {
    const message = messengerWorkerAdapter.parse(SAMPLE_WEBHOOK, 'worker-1', 'workspace-1');
    expect(message?.channel).toBe('messenger');
    expect(message?.contactId).toBe('USER_PSID_123');
  });

  it('verify accepts valid hub signature using META_APP_SECRET', () => {
    process.env.META_APP_SECRET = 'app-secret';
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_WEBHOOK));
    const signature = `sha256=${crypto.createHmac('sha256', 'app-secret').update(rawBody).digest('hex')}`;

    expect(messengerWorkerAdapter.verify(
      { 'x-hub-signature-256': signature },
      rawBody,
      credentials,
    )).toBe(true);
  });

  it('handleMetaWorkerWebhookChallenge returns challenge when verify token matches', () => {
    const challenge = handleMetaWorkerWebhookChallenge({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token',
      'hub.challenge': 'challenge-string-123',
    }, credentials);
    expect(challenge).toBe('challenge-string-123');
  });

  it('send posts to Graph API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await messengerWorkerAdapter.send(
      {
        channel: 'messenger',
        contactId: 'USER_PSID_123',
        content: 'Reply text',
      },
      credentials,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('graph.facebook.com');
    expect(JSON.parse(init.body as string)).toEqual({
      recipient: { id: 'USER_PSID_123' },
      message: { text: 'Reply text' },
    });
  });
});
