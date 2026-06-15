import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../../config/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../config/index.js')>();
  return {
    config: {
      ...actual.config,
      irc: {
        ...actual.config.irc,
        enabled: true,
        live: false,
        server: 'irc.libera.chat',
        nick: 'carina-bot',
        username: 'carina-bot',
        mentionOnly: true,
        channels: [],
      },
    },
  };
});

vi.mock('../../router.js', () => ({
  getRouter: () => ({
    handleInbound: async function* () {
      yield '';
    },
  }),
}));

describe('IrcAdapter', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('documents webhook contract for sidecar fallback', async () => {
    const { IRC_WEBHOOK_CONTRACT } = await import('./irc-adapter.js');
    expect(IRC_WEBHOOK_CONTRACT.inboundWebhook).toBe('/webhooks/irc');
    expect(IRC_WEBHOOK_CONTRACT.transport).toBe('webhook-inbound');
  });

  it('parses sidecar webhook payloads', async () => {
    const { IrcAdapter } = await import('./irc-adapter.js');
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

  it('parses live PRIVMSG payloads with mention gating', async () => {
    const { IrcAdapter } = await import('./irc-adapter.js');
    const adapter = new IrcAdapter(true);
    const msg = adapter.parseLiveMessage({
      nick: 'alice',
      target: '#carina',
      text: 'hey @carina-bot what is SDLT?',
      raw: 'raw',
    });
    expect(msg?.isMention).toBe(true);
    expect(msg?.text).toContain('SDLT');
  });

  it('ignores channel chatter without mention when mention-only', async () => {
    const { IrcAdapter } = await import('./irc-adapter.js');
    const adapter = new IrcAdapter(true);
    expect(adapter.parseLiveMessage({
      nick: 'alice',
      target: '#carina',
      text: 'hello everyone',
      raw: 'raw',
    })).toBeNull();
  });

  it('returns null when required webhook fields missing', async () => {
    const { IrcAdapter } = await import('./irc-adapter.js');
    const adapter = new IrcAdapter(true);
    expect(adapter.parseInbound({ text: 'hi' })).toBeNull();
  });

  it('throws on send when live mode is disabled', async () => {
    vi.doMock('../../irc.js', () => ({
      isIrcLiveEnabled: () => false,
    }));
    const { IrcAdapter } = await import('./irc-adapter.js');
    const adapter = new IrcAdapter(true);
    await expect(adapter.sendMessage('#carina', 'hello')).rejects.toThrow(/IRC live outbound is disabled/);
  });
});
