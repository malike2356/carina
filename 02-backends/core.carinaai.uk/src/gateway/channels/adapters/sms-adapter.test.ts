import { describe, expect, it } from 'vitest';
import { SmsAdapter } from './sms-adapter.js';

describe('SmsAdapter', () => {
  it('normalizes Twilio SMS webhooks into ChannelMessage', () => {
    const adapter = new SmsAdapter(true);

    const message = adapter.parseInbound({
      MessageSid: 'SM1',
      From: '+15551234567',
      Body: 'hello',
    });

    expect(message?.channel).toBe('sms');
    expect(message?.externalUserId).toBe('+15551234567');
    expect(message?.text).toBe('hello');
  });

  it('prefixes every outbound chunk with [Carina]', () => {
    const adapter = new SmsAdapter(true);
    const chunks = adapter.formatForChannel('x'.repeat(250));

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.startsWith('[Carina] '))).toBe(true);
    expect(chunks.every((chunk) => chunk.length <= 160)).toBe(true);
  });

  it('rejects unsigned webhook requests', () => {
    const adapter = new SmsAdapter(true);

    expect(adapter.validateWebhook({ headers: {}, body: {}, url: 'https://example.com/webhooks/sms' })).toBe(false);
  });
});
