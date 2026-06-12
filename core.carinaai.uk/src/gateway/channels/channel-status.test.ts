import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('channel status', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reports IRC as unsupported when not configured', async () => {
    delete process.env.IRC_ENABLED;
    delete process.env.IRC_SERVER;
    delete process.env.IRC_NICK;
    vi.resetModules();
    const { getChannelStatus } = await import('./channel-status.js');
    const irc = getChannelStatus('irc');
    expect(irc?.state).toBe('unsupported');
  }, 15_000);

  it('reports IRC as partial when stub env is set', async () => {
    vi.stubEnv('IRC_ENABLED', 'true');
    vi.stubEnv('IRC_SERVER', 'irc.libera.chat');
    vi.stubEnv('IRC_NICK', 'carina-bot');
    vi.resetModules();
    const { getChannelStatus } = await import('./channel-status.js');
    expect(getChannelStatus('irc')?.state).toBe('partial');
  });

  it('includes whatsapp self-bridge note when baileys enabled', async () => {
    vi.stubEnv('BAILEYS_WHATSAPP_ENABLED', 'true');
    vi.stubEnv('CARINA_WHATSAPP_SELF_BRIDGE', 'true');
    vi.resetModules();
    const { getChannelStatusReports, whatsappSelfBridgeEnabled } = await import('./channel-status.js');
    expect(whatsappSelfBridgeEnabled()).toBe(true);
    const wa = getChannelStatusReports().find((r) => r.channel === 'whatsapp');
    expect(wa?.reason).toMatch(/self-bridge ON/);
  });

  it('marks telegram disabled without token', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    vi.resetModules();
    const { getChannelStatus } = await import('./channel-status.js');
    expect(getChannelStatus('telegram')?.state).toBe('disabled');
  });

  it('reports dingtalk as disabled without env', async () => {
    delete process.env.DINGTALK_WEBHOOK_URL;
    delete process.env.DINGTALK_APP_KEY;
    vi.resetModules();
    const { getChannelStatus } = await import('./channel-status.js');
    expect(getChannelStatus('dingtalk')?.state).toBe('disabled');
  });

  it('exposes channel policy flags', async () => {
    vi.stubEnv('CARINA_THREAD_OWNERSHIP', 'true');
    vi.resetModules();
    const { getChannelPolicyFlags } = await import('./channel-status.js');
    expect(getChannelPolicyFlags().threadOwnership).toBe(true);
    expect(getChannelPolicyFlags().peerScoping).toBe(false);
  });
});
