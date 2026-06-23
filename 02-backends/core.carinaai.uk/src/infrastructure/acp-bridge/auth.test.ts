import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('acp-bridge auth', () => {
  let tmpHome: string;
  let passwordFile: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-acp-auth-'));
    passwordFile = path.join(tmpHome, 'acp.pass');
    fs.writeFileSync(passwordFile, 'secret-token\n');
    vi.resetModules();
    delete process.env.CARINA_ACP_AUTH;
    delete process.env.CARINA_ACP_PASSWORD_FILE;
    delete process.env.CARINA_WEB_PASSWORD;
    delete process.env.CARINA_OPS_TOKEN;
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('requires auth when password file is set', async () => {
    process.env.CARINA_ACP_PASSWORD_FILE = passwordFile;
    const { acpAuthRequired, resolveAcpPassword } = await import('./auth.js');
    expect(acpAuthRequired()).toBe(true);
    expect(resolveAcpPassword()).toBe('secret-token');
  });

  it('can disable auth explicitly', async () => {
    process.env.CARINA_ACP_PASSWORD_FILE = passwordFile;
    process.env.CARINA_ACP_AUTH = 'off';
    const { acpAuthRequired } = await import('./auth.js');
    expect(acpAuthRequired()).toBe(false);
  });

  it('defaults bridge mode to server', async () => {
    const { acpBridgeMode } = await import('./auth.js');
    expect(acpBridgeMode()).toBe('server');
    process.env.CARINA_ACP_MODE = 'bridge';
    vi.resetModules();
    const mod = await import('./auth.js');
    expect(mod.acpBridgeMode()).toBe('bridge');
  });
});
