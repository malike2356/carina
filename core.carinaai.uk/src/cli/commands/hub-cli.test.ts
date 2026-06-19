import os from 'os';
import fsp from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const tmpHome = path.join(os.tmpdir(), `carina-hub-cli-test-${process.pid}`);

afterEach(async () => {
  vi.unstubAllEnvs();
  await fsp.rm(tmpHome, { recursive: true, force: true });
});

describe('hub-cli token helpers', () => {
  it('readHubToken returns stored token from CARINA_HOME', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const tokenPath = path.join(tmpHome, 'hub-token');
    await fsp.mkdir(tmpHome, { recursive: true });
    await fsp.writeFile(tokenPath, 'abc123\n', { mode: 0o600 });

    const { readHubToken } = await import('./hub-cli.js');
    await expect(readHubToken()).resolves.toBe('abc123');
  });

  it('readHubToken returns undefined when no token file exists', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const { readHubToken } = await import('./hub-cli.js');
    await expect(readHubToken()).resolves.toBeUndefined();
  });

  it('login writes token with mode 0o600', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const { runHubCommand } = await import('./hub-cli.js');
    await runHubCommand(['login', 'secret-token']);

    const tokenPath = path.join(tmpHome, 'hub-token');
    await expect(fsp.readFile(tokenPath, 'utf-8')).resolves.toBe('secret-token');
    const stat = await fsp.stat(tokenPath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('logout removes token file', async () => {
    vi.stubEnv('CARINA_HOME', tmpHome);
    const tokenPath = path.join(tmpHome, 'hub-token');
    await fsp.mkdir(tmpHome, { recursive: true });
    await fsp.writeFile(tokenPath, 'secret-token', { mode: 0o600 });

    const { runHubCommand } = await import('./hub-cli.js');
    await runHubCommand(['logout']);
    await expect(fsp.stat(tokenPath)).rejects.toThrow();
  });
});
