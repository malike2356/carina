import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { tiktokWorkerAdapter } from './tiktok-worker-adapter.js';

const SAMPLE_PAYLOAD = {
  event: 'im_receive_msg',
  content: {
    conversation_id: 'conv-123',
    sender_id: 'user-456',
    text: { body: 'Hi from TikTok' },
    message_id: 'msg-789',
    create_time: 1_700_000_000,
  },
};

describe('tiktok-worker-adapter', () => {
  const credentials = {
    access_token: 'tt-access',
    open_id: 'business-open-id',
    webhook_secret: 'tt-webhook-secret',
  };

  it('parse maps TikTok payload to InboundMessage', () => {
    const message = tiktokWorkerAdapter.parse(SAMPLE_PAYLOAD, 'worker-1', 'workspace-1');
    expect(message?.channel).toBe('tiktok');
    expect(message?.contactId).toBe('user-456');
    expect(message?.conversationId).toBe('conv-123');
    expect(message?.content).toBe('Hi from TikTok');
    expect(message?.threadId).toBe('msg-789');
  });

  it('verify accepts valid tiktok-signature', () => {
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    const signature = crypto.createHmac('sha256', credentials.webhook_secret).update(rawBody).digest('hex');
    expect(tiktokWorkerAdapter.verify(
      { 'tiktok-signature': signature },
      rawBody,
      credentials,
    )).toBe(true);
  });

  it('verify rejects invalid signature', () => {
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    expect(tiktokWorkerAdapter.verify(
      { 'tiktok-signature': 'bad' },
      rawBody,
      credentials,
    )).toBe(false);
  });

  it('send posts to TikTok Business Messaging API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await tiktokWorkerAdapter.send(
      {
        channel: 'tiktok',
        contactId: 'user-456',
        content: 'Hello',
        metadata: { conversationId: 'conv-123' },
      },
      credentials,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('business/message/send/');
    expect(JSON.parse(init.body as string)).toMatchObject({
      conversation_id: 'conv-123',
      to_user_id: 'user-456',
      text: { body: 'Hello' },
    });
  });
});
