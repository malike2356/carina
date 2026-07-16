import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveAppTerminalWebSocketUrl', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    process.env.BETTER_AUTH_URL = 'https://app.carinaai.uk';
  });

  afterEach(() => {
    if (previous.NODE_ENV === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_ENV;
    } else {
      vi.stubEnv('NODE_ENV', previous.NODE_ENV);
    }
    if (previous.BETTER_AUTH_URL === undefined) delete process.env.BETTER_AUTH_URL;
    else process.env.BETTER_AUTH_URL = previous.BETTER_AUTH_URL;
    if (previous.NEXT_PUBLIC_APP_URL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = previous.NEXT_PUBLIC_APP_URL;
  });

  it('uses the public app host and wss when only internal host headers are present', async () => {
    const { resolveAppTerminalWebSocketUrl } = await import('./core-proxy.js');
    const request = new Request('http://127.0.0.1:4102/api/terminal/bridge', {
      headers: {
        host: '127.0.0.1:4102',
        'x-forwarded-proto': 'http',
      },
    });
    expect(resolveAppTerminalWebSocketUrl(request)).toBe('wss://app.carinaai.uk/api/terminal/ws');
  });
});

describe('coreProxyEnabled', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    CARINA_USE_CORE_PROXY: process.env.CARINA_USE_CORE_PROXY,
    CARINA_OPS_TOKEN: process.env.CARINA_OPS_TOKEN,
    CARINA_INTERNAL_KEY: process.env.CARINA_INTERNAL_KEY,
    CARINA_CORE_URL: process.env.CARINA_CORE_URL,
  };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('is false without a token', async () => {
    delete process.env.CARINA_OPS_TOKEN;
    delete process.env.CARINA_INTERNAL_KEY;
    process.env.CARINA_USE_CORE_PROXY = 'true';
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(false);
  });

  it('is true when flag is true and token is set', async () => {
    process.env.CARINA_USE_CORE_PROXY = 'true';
    process.env.CARINA_OPS_TOKEN = 'ops-secret';
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(true);
  });

  it('is true in docker prod when token is set even if flag is unset', async () => {
    delete process.env.CARINA_USE_CORE_PROXY;
    vi.stubEnv('NODE_ENV', 'production');
    process.env.CARINA_CORE_URL = 'http://carina-web:3000';
    process.env.CARINA_OPS_TOKEN = 'ops-secret';
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(true);
  });

  it('respects explicit false even with token in docker prod', async () => {
    process.env.CARINA_USE_CORE_PROXY = 'false';
    vi.stubEnv('NODE_ENV', 'production');
    process.env.CARINA_CORE_URL = 'http://carina-web:3000';
    process.env.CARINA_OPS_TOKEN = 'ops-secret';
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(false);
  });
});

describe('shouldRouteChatThroughCore', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
    vi.resetModules();
  });

  it('prefers BYOK when workspace keys exist even if core proxy is on', async () => {
    process.env.CARINA_USE_CORE_PROXY = 'true';
    process.env.CARINA_OPS_TOKEN = 'ops-secret';
    const { shouldRouteChatThroughCore } = await import('./core-proxy.js');
    expect(shouldRouteChatThroughCore(true)).toBe(false);
    expect(shouldRouteChatThroughCore(false)).toBe(true);
  });
});
