import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('host-service', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-host-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function host() {
    return import('./host-service.js');
  }

  it('writes and clears PID files', async () => {
    const mod = await host();
    mod.writeHostPidFile(4242);
    const pidPath = path.join(tmp, 'run', 'carina-gateway.pid');
    expect(fs.readFileSync(pidPath, 'utf-8').trim()).toBe('4242');
    mod.clearHostPidFile();
    expect(fs.existsSync(pidPath)).toBe(false);
  });

  it('renders a systemd user unit template', async () => {
    const mod = await host();
    const unit = mod.systemdUnitTemplate('/usr/bin/carina web');
    expect(unit).toContain('Description=Carina Agent Gateway');
    expect(unit).toContain('ExecStart=/usr/bin/carina web');
    expect(unit).toContain(`CARINA_HOME=${tmp.replace(/\\/g, '/')}`);
  });

  it('reports host status with agents and devices counts', async () => {
    const pairing = await import('./device-pairing.js');
    const pending = pairing.createPairingCode();
    pairing.claimPairing({ code: pending.code, name: 'Phone', platform: 'ios' });

    const mod = await host();
    mod.writeHostPidFile(process.pid);
    const status = await mod.getHostServiceStatus('9.9.9');
    expect(status.running).toBe(true);
    expect(status.version).toBe('9.9.9');
    expect(status.pairedDevices).toBe(1);
    expect(status.carinaHome).toBe(tmp);
    expect(Array.isArray(status.channels)).toBe(true);
  });
});
