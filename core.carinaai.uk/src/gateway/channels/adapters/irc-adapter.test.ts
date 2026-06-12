import { describe, expect, it } from 'vitest';
import { IrcAdapter } from './irc-adapter.js';

describe('IrcAdapter stub', () => {
  it('parses sidecar webhook payloads', () => {
    const adapter = new IrcAdapter(true);
    const msg = adapter.parseInbound({
      text: 'hello channel',
      nick: 'alice',
      channel: '#carina',
      id: '42',
    });
    expect(msg?.channel).toBe('irc');
    expect(msg?.externalUserId).toBe('alice');
    expect(msg?.conversationId).toBe('#carina');
  });

  it('returns null when required fields missing', () => {
    const adapter = new IrcAdapter(true);
    expect(adapter.parseInbound({ text: 'hi' })).toBeNull();
  });

  it('throws on send', async () => {
    const adapter = new IrcAdapter(true);
    await expect(adapter.sendMessage('#carina', 'hello')).rejects.toThrow(/stub/);
  });
});
