import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { LineAdapter } from './line-adapter.js';

describe('LineAdapter', () => {
  const secret = 'line-secret-test';
  const adapter = new LineAdapter(true, secret, 'line-token-test');

  it('parses text message events', () => {
    const message = adapter.parseInbound({
      events: [
        {
          type: 'message',
          replyToken: 'reply-token-1',
          source: { userId: 'U123' },
          message: { id: 'm1', type: 'text', text: 'Hello Line' },
        },
      ],
    });

    expect(message?.channel).toBe('line');
    expect(message?.text).toBe('Hello Line');
    expect(message?.externalUserId).toBe('U123');
    expect(message?.conversationId).toBe('U123');
  });

  it('validates X-Line-Signature HMAC', () => {
    const body = JSON.stringify({ events: [] });
    const signature = crypto.createHmac('sha256', secret).update(body).digest('base64');

    expect(adapter.validateWebhook({
      headers: { 'x-line-signature': signature },
      body: JSON.parse(body),
      rawBody: body,
    })).toBe(true);

    expect(adapter.validateWebhook({
      headers: { 'x-line-signature': 'invalid' },
      body: {},
      rawBody: body,
    })).toBe(false);
  });

  it('formats messages within LINE length limits', () => {
    const chunks = adapter.formatForChannel('a'.repeat(6000));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 5000)).toBe(true);
  });
});
