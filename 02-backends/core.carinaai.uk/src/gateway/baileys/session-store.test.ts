import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { decrypt, encrypt, requireSessionSecret, useEncryptedAuthState } from './session-store.js';

const tmpDirs: string[] = [];

async function makeTmpDir(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'carina-wa-session-'));
  tmpDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tmpDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe('session-store', () => {
  it('round-trips encrypt and decrypt', () => {
    const secret = 'x'.repeat(32);
    const plaintext = Buffer.from('signal session payload');
    const blob = encrypt(plaintext, secret);
    expect(decrypt(blob, secret).equals(plaintext)).toBe(true);
  });

  it('requires a session secret of at least 32 characters', () => {
    delete process.env.CARINA_WHATSAPP_SESSION_SECRET;
    expect(() => requireSessionSecret()).toThrow(/CARINA_WHATSAPP_SESSION_SECRET/);

    process.env.CARINA_WHATSAPP_SESSION_SECRET = 'short';
    expect(() => requireSessionSecret()).toThrow(/at least 32/);

    process.env.CARINA_WHATSAPP_SESSION_SECRET = 'a'.repeat(32);
    expect(requireSessionSecret()).toBe('a'.repeat(32));
    delete process.env.CARINA_WHATSAPP_SESSION_SECRET;
  });

  it('stores creds as encrypted files with 0600 permissions', async () => {
    const folder = await makeTmpDir();
    const secret = 'b'.repeat(40);
    const { state, saveCreds } = await useEncryptedAuthState(folder, secret);

    state.creds.registered = true;
    state.creds.account = { details: 'encrypted-test', accountSignatureKey: 'sig', accountSignature: 'sig2' };
    await saveCreds();

    const credsPath = path.join(folder, 'creds.enc');
    const mode = (await fs.stat(credsPath)).mode & 0o777;
    expect(mode).toBe(0o600);
    await expect(fs.readFile(path.join(folder, 'creds.json'))).rejects.toThrow();

    const reloaded = await useEncryptedAuthState(folder, secret);
    expect(reloaded.state.creds.registered).toBe(true);
    expect(reloaded.state.creds.account?.details).toBe('encrypted-test');
  });

  it('auto-migrates legacy plaintext creds.json on read', async () => {
    const folder = await makeTmpDir();
    const secret = 'c'.repeat(40);
    await fs.writeFile(
      path.join(folder, 'creds.json'),
      JSON.stringify({ registered: true, me: { id: '123@s.whatsapp.net' } }),
      'utf8',
    );

    const { state } = await useEncryptedAuthState(folder, secret);
    expect(state.creds.registered).toBe(true);
    await expect(fs.stat(path.join(folder, 'creds.enc'))).resolves.toBeDefined();
    await expect(fs.stat(path.join(folder, 'creds.json'))).rejects.toThrow();
  });
});
