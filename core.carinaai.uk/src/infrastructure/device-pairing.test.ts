import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('device-pairing', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-pair-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function pairing() {
    return import('./device-pairing.js');
  }

  it('creates and claims a pairing code', async () => {
    const mod = await pairing();
    const pending = mod.createPairingCode();
    expect(pending.code).toMatch(/^[A-F0-9]{6}$/);

    const result = mod.claimPairing({
      code: pending.code,
      name: 'Test Phone',
      platform: 'ios',
    });
    expect(result.token).toMatch(/^cdv_/);
    expect(result.name).toBe('Test Phone');
    expect(mod.getPendingPairing()).toBeNull();
    expect(mod.listPairedDevices()).toHaveLength(1);
  });

  it('rejects invalid pairing codes', async () => {
    const mod = await pairing();
    mod.createPairingCode();
    expect(() => mod.claimPairing({ code: 'BAD000', name: 'x', platform: 'web' }))
      .toThrow(/Invalid or expired/);
  });

  it('validates device bearer tokens', async () => {
    const mod = await pairing();
    const pending = mod.createPairingCode();
    const { token } = mod.claimPairing({ code: pending.code, name: 'Pad', platform: 'android' });
    const device = mod.validateDeviceToken(token);
    expect(device?.name).toBe('Pad');
    expect(mod.validateDeviceToken('cdv_invalid')).toBeNull();
  });

  it('revokes paired devices', async () => {
    const mod = await pairing();
    const pending = mod.createPairingCode();
    const { deviceId } = mod.claimPairing({ code: pending.code, name: 'Pad', platform: 'android' });
    expect(mod.revokePairedDevice(deviceId)).toBe(true);
    expect(mod.listPairedDevices()).toHaveLength(0);
  });

  it('rotates device bearer tokens', async () => {
    const mod = await pairing();
    const pending = mod.createPairingCode();
    const { token, deviceId } = mod.claimPairing({ code: pending.code, name: 'Pad', platform: 'android' });
    const rotated = mod.rotateDeviceToken(deviceId);
    expect(rotated?.token).toMatch(/^cdv_/);
    expect(mod.validateDeviceToken(token)).toBeNull();
    expect(mod.validateDeviceToken(rotated!.token)?.name).toBe('Pad');
  });

  it('redacts token hashes for API responses', async () => {
    const mod = await pairing();
    const pending = mod.createPairingCode();
    mod.claimPairing({ code: pending.code, name: 'Pad', platform: 'android' });
    const redacted = mod.redactDevicesForApi(mod.listPairedDevices());
    expect(redacted[0]).not.toHaveProperty('tokenHash');
    expect(redacted[0].name).toBe('Pad');
  });
});
