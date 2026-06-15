import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('stub-channels', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides IRC from product surfaces unless configured', async () => {
    delete process.env.IRC_ENABLED;
    delete process.env.IRC_SERVER;
    delete process.env.IRC_NICK;
    vi.resetModules();
    const { shouldExposeChannel } = await import('./stub-channels.js');
    expect(shouldExposeChannel('irc')).toBe(false);
    expect(shouldExposeChannel('telegram')).toBe(true);
  });

  it('exposes IRC when live env is configured', async () => {
    vi.stubEnv('IRC_ENABLED', 'true');
    vi.stubEnv('IRC_SERVER', 'irc.libera.chat');
    vi.stubEnv('IRC_NICK', 'carina-bot');
    vi.resetModules();
    const { shouldExposeChannel } = await import('./stub-channels.js');
    expect(shouldExposeChannel('irc')).toBe(true);
  });
});
