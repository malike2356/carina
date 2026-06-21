import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('scout base URL', () => {
  const previousEnv = {
    SCOUT_ADMIN_API_URL: process.env.SCOUT_ADMIN_API_URL,
    SCOUT_ENGINE_URL: process.env.SCOUT_ENGINE_URL,
    SCOUT_CONSOLE_URL: process.env.SCOUT_CONSOLE_URL,
    SCOUT_URL: process.env.SCOUT_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SCOUT_ADMIN_API_URL;
    delete process.env.SCOUT_ENGINE_URL;
    delete process.env.SCOUT_CONSOLE_URL;
    delete process.env.SCOUT_URL;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('defaults engine to 4455 and console to 4444 when unset', async () => {
    const { SCOUT_BASE, SCOUT_CONSOLE_BASE, SCOUT_DASHBOARD_API } = await import('./scout.js');
    expect(SCOUT_BASE).toBe('http://127.0.0.1:4455');
    expect(SCOUT_CONSOLE_BASE).toBe('http://127.0.0.1:4444');
    expect(SCOUT_DASHBOARD_API).toBe('http://127.0.0.1:4444');
  });

  it('honors explicit admin and console overrides', async () => {
    process.env.SCOUT_ADMIN_API_URL = 'http://10.0.0.10:4455';
    process.env.SCOUT_CONSOLE_URL = 'http://10.0.0.10:4444';
    const { SCOUT_BASE, SCOUT_CONSOLE_BASE } = await import('./scout.js');
    expect(SCOUT_BASE).toBe('http://10.0.0.10:4455');
    expect(SCOUT_CONSOLE_BASE).toBe('http://10.0.0.10:4444');
  });
});
