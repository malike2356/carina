import crypto from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractWhatsAppPhoneNumberId,
  extractWhatsAppStatuses,
  listWhatsAppInboundMessages,
  WhatsApp24hWindowError,
  whatsappAdapter,
} from './whatsapp-adapter.js';

const sampleBatchPayload = {
  entry: [{
    changes: [{
      value: {
        metadata: { phone_number_id: '123456789' },
        contacts: [
          { wa_id: '447700900001', profile: { name: 'Alice' } },
          { wa_id: '447700900002', profile: { name: 'Bob' } },
        ],
        messages: [
          {
            from: '447700900001',
            id: 'wamid.1',
            timestamp: '1710000000',
            type: 'text',
            text: { body: 'First message' },
          },
          {
            from: '447700900002',
            id: 'wamid.2',
            timestamp: '1710000001',
            type: 'text',
            text: { body: 'Second message' },
          },
          {
            from: '447700900001',
            id: 'wamid.3',
            timestamp: '1710000002',
            type: 'image',
          },
        ],
      },
    }],
  }],
};

describe('whatsapp-adapter', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('parses every text message in a webhook batch with per-contact names', () => {
    const messages = listWhatsAppInboundMessages(sampleBatchPayload, 'worker-1', 'ws-1');
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({
      contactId: '447700900001',
      contactName: 'Alice',
      content: 'First message',
      threadId: 'wamid.1',
    });
    expect(messages[1]).toMatchObject({
      contactId: '447700900002',
      contactName: 'Bob',
      content: 'Second message',
      threadId: 'wamid.2',
    });
  });

  it('parse() returns only the first text message when payload contains several', () => {
    const parsed = whatsappAdapter.parse(sampleBatchPayload, 'worker-1', 'ws-1');
    expect(parsed?.content).toBe('First message');
    expect(parsed?.threadId).toBe('wamid.1');
  });

  it('extracts delivery status webhooks including failure metadata', () => {
    const statuses = extractWhatsAppStatuses({
      entry: [{
        changes: [{
          value: {
            statuses: [{
              id: 'wamid.out',
              status: 'failed',
              recipient_id: '447700900001',
              errors: [{ code: 131047, title: 'Re-engagement message' }],
            }],
          },
        }],
      }],
    });
    expect(statuses).toEqual([{
      id: 'wamid.out',
      status: 'failed',
      recipientId: '447700900001',
      errors: [{ code: 131047, title: 'Re-engagement message' }],
    }]);
  });

  it('verifies X-Hub-Signature-256 with WHATSAPP_APP_SECRET', () => {
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const rawBody = Buffer.from('{"hello":"world"}');
    const digest = crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
    expect(whatsappAdapter.verify({ 'x-hub-signature-256': `sha256=${digest}` }, rawBody)).toBe(true);
    expect(whatsappAdapter.verify({ 'x-hub-signature-256': 'sha256=bad' }, rawBody)).toBe(false);
  });

  it('throws WhatsApp24hWindowError when Meta returns code 131047', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: 131047 } }),
    } as Response);

    await expect(whatsappAdapter.send(
      { channel: 'whatsapp', contactId: '447700900001', content: 'Hello' },
      { access_token: 'token', phone_number_id: '123' },
    )).rejects.toBeInstanceOf(WhatsApp24hWindowError);
  });

  it('extracts phone number id for worker registry lookup', () => {
    expect(extractWhatsAppPhoneNumberId(sampleBatchPayload)).toBe('123456789');
  });
});
