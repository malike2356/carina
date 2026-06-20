import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('carina base URL', () => {
  const previousEnv = {
    CARINA_API_URL: process.env.CARINA_API_URL,
  };

  beforeEach(() => {
    vi.resetModules();
    delete process.env.CARINA_API_URL;
  });

  afterEach(() => {
    if (previousEnv.CARINA_API_URL === undefined) {
      delete process.env.CARINA_API_URL;
    } else {
      process.env.CARINA_API_URL = previousEnv.CARINA_API_URL;
    }
  });

  it('defaults to the production core host when unset', async () => {
    const { CARINA_BASE } = await import('./carina.js');
    expect(CARINA_BASE).toBe('https://core.carinaai.uk');
  });

  it('honors an explicit override', async () => {
    process.env.CARINA_API_URL = 'http://127.0.0.1:3333';
    const { CARINA_BASE } = await import('./carina.js');
    expect(CARINA_BASE).toBe('http://127.0.0.1:3333');
  });
});
