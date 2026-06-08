import { describe, expect, it } from 'vitest';
import { WhatsAppAdapter } from './whatsapp-adapter.js';

describe('WhatsAppAdapter', () => {
  it('normalizes Twilio WhatsApp webhooks into ChannelMessage', () => {
    const adapter = new WhatsAppAdapter(true);

    const message = adapter.parseInbound({
      MessageSid: 'WA1',
      From: 'whatsapp:+15551234567',
      Body: 'hello',
      NumMedia: '1',
      MediaUrl0: 'https://example.com/file.jpg',
      MediaContentType0: 'image/jpeg',
    });

    expect(message?.channel).toBe('whatsapp');
    expect(message?.attachments).toHaveLength(1);
  });

  it('formats messages to WhatsApp length limits', () => {
    const adapter = new WhatsAppAdapter(true);
    const chunks = adapter.formatForChannel('w'.repeat(1700));

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.length <= 1600)).toBe(true);
  });

  it('rejects unsigned webhook requests', () => {
    const adapter = new WhatsAppAdapter(true);

    expect(adapter.validateWebhook({ headers: {}, body: {}, url: 'https://example.com/webhooks/whatsapp' })).toBe(false);
  });
});
