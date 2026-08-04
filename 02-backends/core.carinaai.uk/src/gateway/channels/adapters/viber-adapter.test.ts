import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { ViberAdapter } from './viber-adapter.js';

describe('ViberAdapter', () => {
  const token = 'viber-auth-token';
  const adapter = new ViberAdapter(true, token);

  it('parses incoming text messages', () => {
    const message = adapter.parseInbound({
      event: 'message',
      timestamp: 1700000000,
      sender: { id: 'viber-user-1', name: 'Alex' },
      message: { type: 'text', text: 'Need a quote', token: 42 },
    });

    expect(message?.channel).toBe('viber');
    expect(message?.text).toBe('Need a quote');
    expect(message?.conversationId).toBe('viber-user-1');
    expect(message?.senderName).toBe('Alex');
  });

  it('validates X-Viber-Content-Signature HMAC', () => {
    const body = JSON.stringify({ event: 'message' });
    const signature = crypto.createHmac('sha256', token).update(body).digest('base64');

    expect(adapter.validateWebhook({
      headers: { 'x-viber-content-signature': signature },
      body: JSON.parse(body),
      rawBody: body,
    })).toBe(true);
  });
});
