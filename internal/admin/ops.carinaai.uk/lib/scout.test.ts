import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('scout base URL', () => {
  const previousEnv = {
    SCOUT_URL: process.env.SCOUT_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.SCOUT_URL;
  });

  afterEach(() => {
    if (previousEnv.SCOUT_URL === undefined) {
      delete process.env.SCOUT_URL;
    } else {
      process.env.SCOUT_URL = previousEnv.SCOUT_URL;
    }
  });

  it('defaults to the production Scout host when unset', async () => {
    const { SCOUT_BASE } = await import('./scout.js');
    expect(SCOUT_BASE).toBe('https://console.labyrinthscout.com');
  });

  it('honors an explicit override', async () => {
    process.env.SCOUT_URL = 'http://127.0.0.1:4444';
    const { SCOUT_BASE } = await import('./scout.js');
    expect(SCOUT_BASE).toBe('http://127.0.0.1:4444');
  });
});
