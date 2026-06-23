import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tmpDir = path.join(os.tmpdir(), `carina-env-file-${Date.now()}`);

vi.mock('../config/paths.js', () => ({
  CARINA_ENV_PATH: path.join(tmpDir, 'home.env'),
}));

describe('env-file', () => {
  beforeEach(async () => {
    vi.resetModules();
    await fs.rm(tmpDir, { recursive: true, force: true });
    await fs.mkdir(tmpDir, { recursive: true });
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('writes and updates env vars in cwd .env', async () => {
    const { setEnvVarInFile, readEnvVarFromFile } = await import('./env-file.js');
    setEnvVarInFile('CARINA_WEB_PASSWORD', '$2a$10$hash');
    expect(readEnvVarFromFile('CARINA_WEB_PASSWORD')).toBe('$2a$10$hash');
    setEnvVarInFile('CARINA_WEB_PASSWORD', '$2a$10$newhash');
    expect(readEnvVarFromFile('CARINA_WEB_PASSWORD')).toBe('$2a$10$newhash');
  });
});
