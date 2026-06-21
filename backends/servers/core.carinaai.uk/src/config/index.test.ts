import fs from 'fs';
import os from 'os';
import path from 'path';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

describe('config', () => {
  let cwd: string;
  let tmpDir: string;

  beforeEach(() => {
    cwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-config-'));
    process.chdir(tmpDir);
    vi.resetModules();
  });

  afterEach(() => {
    process.chdir(cwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('falls back to DATABASE_URL for the skills hub database', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://example/db');
    const { config } = await import('./index.js');
    expect(config.hub.databaseUrl).toBe('postgresql://example/db');
  });

  it('keeps an explicit skills hub database url', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://example/db');
    vi.stubEnv('SKILLS_HUB_DATABASE_URL', 'postgresql://example/hub');
    const { config } = await import('./index.js');
    expect(config.hub.databaseUrl).toBe('postgresql://example/hub');
  });
});
