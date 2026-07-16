import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const tmpDir = path.join(os.tmpdir(), `carina-web-pw-${Date.now()}`);

vi.mock('./env-file.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./env-file.js')>();
  return {
    ...original,
    readEnvVarFromFile: vi.fn(() => undefined),
    setEnvVarInFile: vi.fn(),
  };
});

describe('web-password', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    delete process.env.CARINA_WEB_PASSWORD;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    delete process.env.CARINA_WEB_PASSWORD;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('reports unset password status', async () => {
    const mod = await import('./web-password.js');
    expect(mod.getWebPasswordStatus().set).toBe(false);
  });

  it('hashes and applies a new web password', async () => {
    const { setEnvVarInFile } = await import('./env-file.js');
    const mod = await import('./web-password.js');
    const result = await mod.setWebPassword('long-enough-password', 'long-enough-password', 'ops-admin');
    expect(result.updatedAt).toBeTruthy();
    expect(vi.mocked(setEnvVarInFile)).toHaveBeenCalledWith(
      'CARINA_WEB_PASSWORD',
      expect.stringMatching(/^\$2/),
    );
    expect(process.env.CARINA_WEB_PASSWORD?.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('long-enough-password', process.env.CARINA_WEB_PASSWORD ?? '')).toBe(true);
    expect(mod.getWebPasswordStatus().set).toBe(true);
  });

  it('rejects mismatched passwords', async () => {
    const mod = await import('./web-password.js');
    await expect(mod.setWebPassword('long-enough-password', 'other-password')).rejects.toThrow(/match/i);
  });
});
