import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

describe('resolveAppTerminalWebSocketUrl', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    setEnv('NODE_ENV', 'production');
    setEnv('BETTER_AUTH_URL', 'https://app.carinaai.uk');
  });

  afterEach(() => {
    setEnv('NODE_ENV', previous.NODE_ENV);
    setEnv('BETTER_AUTH_URL', previous.BETTER_AUTH_URL);
    setEnv('NEXT_PUBLIC_APP_URL', previous.NEXT_PUBLIC_APP_URL);
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
      setEnv(key, value);
    }
  });

  it('is false without a token', async () => {
    setEnv('CARINA_OPS_TOKEN', undefined);
    setEnv('CARINA_INTERNAL_KEY', undefined);
    setEnv('CARINA_USE_CORE_PROXY', 'true');
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(false);
  });

  it('is true when flag is true and token is set', async () => {
    setEnv('CARINA_USE_CORE_PROXY', 'true');
    setEnv('CARINA_OPS_TOKEN', 'ops-secret');
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(true);
  });

  it('is true in docker prod when token is set even if flag is unset', async () => {
    setEnv('CARINA_USE_CORE_PROXY', undefined);
    setEnv('NODE_ENV', 'production');
    setEnv('CARINA_CORE_URL', 'http://carina-web:3000');
    setEnv('CARINA_OPS_TOKEN', 'ops-secret');
    const { coreProxyEnabled } = await import('./core-proxy.js');
    expect(coreProxyEnabled()).toBe(true);
  });

  it('respects explicit false even with token in docker prod', async () => {
    setEnv('CARINA_USE_CORE_PROXY', 'false');
    setEnv('NODE_ENV', 'production');
    setEnv('CARINA_CORE_URL', 'http://carina-web:3000');
    setEnv('CARINA_OPS_TOKEN', 'ops-secret');
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
    setEnv('CARINA_USE_CORE_PROXY', 'true');
    setEnv('CARINA_OPS_TOKEN', 'ops-secret');
    const { shouldRouteChatThroughCore } = await import('./core-proxy.js');
    expect(shouldRouteChatThroughCore(true)).toBe(false);
    expect(shouldRouteChatThroughCore(false)).toBe(true);
  });
});
