import { describe, expect, it } from 'vitest';
import { ApiServerAdapter } from './api-server-adapter.js';

describe('ApiServerAdapter', () => {
  it('parses API channel message', () => {
    const adapter = new ApiServerAdapter(true, 'test-key');
    const msg = adapter.parseInbound({
      user_id: 'client-1',
      message: 'status?',
    });
    expect(msg?.text).toBe('status?');
    expect(msg?.channel).toBe('api');
  });

  it('queues sync replies', async () => {
    const adapter = new ApiServerAdapter(true, 'test-key');
    await adapter.sendMessage('conv-1', 'hello back');
    expect(adapter.drainReply('conv-1')).toBe('hello back');
    expect(adapter.drainReply('conv-1')).toBe('');
  });

  it('validates api key header', () => {
    const adapter = new ApiServerAdapter(true, 'secret');
    expect(adapter.validateApiKey({ authorization: 'Bearer secret' })).toBe(true);
    expect(adapter.validateApiKey({ 'x-api-key': 'secret' })).toBe(true);
    expect(adapter.validateApiKey({ authorization: 'Bearer wrong' })).toBe(false);
  });
});
