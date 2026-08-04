import { describe, expect, it } from 'vitest';
import { SignalAdapter } from './signal-adapter.js';

describe('SignalAdapter', () => {
  it('parses inbound signal-cli-rest-api style payload', () => {
    const adapter = new SignalAdapter(true, 'http://localhost:8080', 'key', '+100');
    const msg = adapter.parseInbound({
      envelope: { sourceNumber: '+15551234' },
      message: 'hello carina',
      id: '99',
    });
    expect(msg?.text).toBe('hello carina');
    expect(msg?.channel).toBe('signal');
    expect(msg?.externalUserId).toBe('+15551234');
  });
});
