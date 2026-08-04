import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('carina ops token', () => {
  let tmpDir = '';

  beforeEach(async () => {
    vi.resetModules();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-ops-token-'));
    process.env.CARINA_CORE_ENV_PATH = path.join(tmpDir, 'core.env');
    process.env.CARINA_OPS_TOKEN = 'stale-process-token';
    await fs.writeFile(process.env.CARINA_CORE_ENV_PATH, 'CARINA_OPS_TOKEN=mounted-core-token\n', 'utf8');
  });

  afterEach(async () => {
    delete process.env.CARINA_CORE_ENV_PATH;
    delete process.env.CARINA_OPS_TOKEN;
    if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('uses the mounted core.env token for upstream auth headers', async () => {
    const { carinaHeaders } = await import('./carina.js');
    expect(carinaHeaders().Authorization).toBe('Bearer mounted-core-token');
  });
});

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

  it('rewrites docker-internal carina-web URL when not running in Docker', async () => {
    process.env.CARINA_API_URL = 'http://carina-web:3000';
    delete process.env.CARINA_OPS_IN_DOCKER;
    const { CARINA_BASE, resolveCarinaApiUrl } = await import('./carina.js');
    expect(CARINA_BASE).toBe('https://core.carinaai.uk');
    expect(resolveCarinaApiUrl()).toBe('https://core.carinaai.uk');
  });

  it('keeps docker-internal carina-web URL inside Docker ops', async () => {
    process.env.CARINA_API_URL = 'http://carina-web:3000';
    process.env.CARINA_OPS_IN_DOCKER = 'true';
    const { CARINA_BASE } = await import('./carina.js');
    expect(CARINA_BASE).toBe('http://carina-web:3000');
    delete process.env.CARINA_OPS_IN_DOCKER;
  });
});
