import crypto from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  linkedinWorkerAdapter,
} from './linkedin-worker-adapter.js';

const SAMPLE_PAYLOAD = {
  message: {
    id: 'msg-li-1',
    from: { person: 'urn:li:person:abc123' },
    content: { text: '/help please' },
    conversation: { id: 'urn:li:conversation:xyz789' },
  },
};

describe('linkedin-worker-adapter', () => {
  const credentials = {
    access_token: 'li-access-token',
    webhook_secret: 'li-webhook-secret',
    member_id: 'urn:li:person:member',
  };

  it('parse maps LinkedIn payload to InboundMessage', () => {
    const message = linkedinWorkerAdapter.parse(
      SAMPLE_PAYLOAD,
      'worker-1',
      'workspace-1',
    );

    expect(message?.channel).toBe('linkedin');
    expect(message?.contactId).toBe('urn:li:person:abc123');
    expect(message?.conversationId).toBe('urn:li:conversation:xyz789');
    expect(message?.content).toBe('/help please');
  });

  it('verify accepts valid x-li-signature', () => {
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    const signature = crypto.createHmac('sha256', credentials.webhook_secret).update(rawBody).digest('hex');

    expect(linkedinWorkerAdapter.verify(
      { 'x-li-signature': signature },
      rawBody,
      credentials,
    )).toBe(true);
  });

  it('verify rejects invalid signature', () => {
    const rawBody = Buffer.from(JSON.stringify(SAMPLE_PAYLOAD));
    expect(linkedinWorkerAdapter.verify(
      { 'x-li-signature': 'bad' },
      rawBody,
      credentials,
    )).toBe(false);
  });

  it('send posts to LinkedIn messages API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    await linkedinWorkerAdapter.send(
      {
        channel: 'linkedin',
        contactId: 'urn:li:person:abc123',
        content: 'Hello',
        metadata: { conversationId: 'urn:li:conversation:xyz789' },
      },
      credentials,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      recipients: [{ person: 'urn:li:conversation:xyz789' }],
      subject: '',
      body: 'Hello',
    });
  });
});
