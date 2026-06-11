import { describe, expect, it } from 'vitest';
import { WebhookChannelAdapter } from './webhook-channel-adapter.js';

describe('WebhookChannelAdapter', () => {
  it('parses inbound with callback_url', () => {
    const adapter = new WebhookChannelAdapter(true, 'secret');
    const msg = adapter.parseInbound({
      message: 'ping',
      user_id: 'u1',
      callback_url: 'https://example.com/reply',
    });
    expect(msg?.text).toBe('ping');
    expect(msg?.channel).toBe('webhooks');
  });

  it('validates webhook secret', () => {
    const adapter = new WebhookChannelAdapter(true, 'secret');
    expect(adapter.validateWebhook({ headers: { 'x-webhook-secret': 'secret' }, body: {} })).toBe(true);
    expect(adapter.validateWebhook({ headers: { 'x-webhook-secret': 'nope' }, body: {} })).toBe(false);
  });
});
