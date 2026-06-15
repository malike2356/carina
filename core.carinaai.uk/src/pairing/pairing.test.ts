import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('pairing (O7 token flow)', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-pair-o7-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function pairing() {
    return import('../pairing/pairing.js');
  }

  it('creates a 64-char hex pairing token', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    expect(session.token).toMatch(/^[a-f0-9]{64}$/);
    expect(session.uri).toContain('carina://pair?token=');
  });

  it('accepts token and returns paired device', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    const result = mod.acceptPairingToken(session.token, 'Phone');
    expect(result.status).toBe('paired');
    expect(result.deviceId).toBeTruthy();
    expect(result.token).toMatch(/^cdv_/);
    expect(mod.listPairDevicesForApi().some((d) => d.id === result.deviceId)).toBe(true);
  });

  it('pairing token expires after 5 minutes', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    const pendingPath = path.join(tmp, 'pair-pending-tokens.json');
    const raw = JSON.parse(fs.readFileSync(pendingPath, 'utf8')) as {
      tokens: Array<{ expiresAt: string }>;
    };
    raw.tokens[0]!.expiresAt = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(pendingPath, JSON.stringify(raw));
    expect(mod.isPairingTokenExpired(session.token)).toBe(true);
    expect(() => mod.acceptPairingToken(session.token, 'Late')).toThrow(/expired/i);
  });

  it('rejects reused pairing token on second accept', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    mod.acceptPairingToken(session.token, 'Phone');
    expect(() => mod.acceptPairingToken(session.token, 'Phone 2')).toThrow(/Invalid|expired/i);
  });

  it('paired device list returns correct records', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    const accepted = mod.acceptPairingToken(session.token, 'Tablet');
    const rows = mod.listPairDevicesForApi();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(accepted.deviceId);
    expect(rows[0]?.name).toBe('Tablet');
  });

  it('revoke removes device from paired list', async () => {
    const mod = await pairing();
    const session = mod.createPairingToken();
    const accepted = mod.acceptPairingToken(session.token, 'Pad');
    expect(mod.revokePairDevice(accepted.deviceId)).toBe(true);
    expect(mod.listPairDevicesForApi()).toHaveLength(0);
  });

  it('renders terminal QR blocks', async () => {
    const mod = await pairing();
    const qr = mod.renderTerminalQr('carina://pair?token=abc');
    expect(qr.split('\n').length).toBe(10);
    expect(qr).toContain('██');
  });
});
