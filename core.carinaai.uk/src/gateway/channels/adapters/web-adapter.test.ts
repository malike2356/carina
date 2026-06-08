import { describe, expect, it } from 'vitest';
import { WebAdapter } from './web-adapter.js';

describe('WebAdapter', () => {
  it('normalizes web chat payloads into ChannelMessage', () => {
    const adapter = new WebAdapter(true);

    const message = adapter.parseInbound({
      id: 'web1',
      sessionId: 'browser-session',
      message: '/model openai',
    });

    expect(message?.channel).toBe('web');
    expect(message?.conversationId).toBe('browser-session');
    expect(message?.isCommand).toBe(true);
  });

  it('accepts webhook validation', () => {
    const adapter = new WebAdapter(true);

    expect(adapter.validateWebhook()).toBe(true);
  });
});
