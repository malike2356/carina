import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readEnvValue } from './core-env.js';

describe('core-env', () => {
  const tmpDir = path.join(os.tmpdir(), `ops-core-env-${Date.now()}`);
  let envPath = '';

  beforeEach(async () => {
    await fs.mkdir(tmpDir, { recursive: true });
    envPath = path.join(tmpDir, '.env');
    await fs.writeFile(envPath, 'CARINA_OPS_TOKEN=secret-token-123\n', 'utf8');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reads values from an env file', () => {
    expect(readEnvValue(envPath, 'CARINA_OPS_TOKEN')).toBe('secret-token-123');
    expect(readEnvValue(envPath, 'MISSING')).toBeNull();
  });

  it('reads CARINA_OPS_TOKEN from an explicit docker runtime env path', async () => {
    const prevPath = process.env.CARINA_CORE_ENV_PATH;
    const runtimePath = path.join(tmpDir, '.env.docker.runtime');
    await fs.writeFile(runtimePath, 'CARINA_OPS_TOKEN=docker-runtime-token\n', 'utf8');
    process.env.CARINA_CORE_ENV_PATH = runtimePath;
    vi.resetModules();
    const { readCoreOpsToken } = await import('./core-env.js');
    expect(readCoreOpsToken()).toBe('docker-runtime-token');
    if (prevPath === undefined) delete process.env.CARINA_CORE_ENV_PATH;
    else process.env.CARINA_CORE_ENV_PATH = prevPath;
  });
});
