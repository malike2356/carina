import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveAppTerminalWebSocketUrl', () => {
  const previous = {
    NODE_ENV: process.env.NODE_ENV,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    process.env.NODE_ENV = 'production';
    process.env.BETTER_AUTH_URL = 'https://app.carinaai.uk';
  });

  afterEach(() => {
    if (previous.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous.NODE_ENV;
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
