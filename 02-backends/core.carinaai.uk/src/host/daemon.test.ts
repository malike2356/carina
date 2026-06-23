import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('host daemon', () => {
  let tmp = '';

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-daemon-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
    process.env.WEB_PORT = '7430';
  });

  afterEach(() => {
    delete process.env.CARINA_HOME;
    delete process.env.WEB_PORT;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function daemon() {
    return import('../host/daemon.js');
  }

  it('detects current OS service manager', async () => {
    const mod = await daemon();
    const manager = mod.detectServiceManager();
    if (process.platform === 'linux') expect(manager).toBe('systemd');
    if (process.platform === 'darwin') expect(manager).toBe('launchd');
    if (process.platform === 'win32') expect(manager).toBe('schtasks');
  });

  it('generates valid systemd unit file on Linux', async () => {
    const mod = await daemon();
    const unit = mod.systemdUnitTemplate('carina serve');
    expect(unit).toContain('Description=Carina Agent Gateway');
    expect(unit).toContain('ExecStart=carina serve');
    expect(unit).toContain(`CARINA_HOME=${tmp.replace(/\\/g, '/')}`);
  });

  it('generates valid launchd plist on macOS template', async () => {
    const mod = await daemon();
    const plist = mod.launchdPlistTemplate('carina serve');
    expect(plist).toContain('<key>Label</key>');
    expect(plist).toContain('com.carina.gateway');
    expect(plist).toContain('carina serve');
    expect(plist).toContain('<key>KeepAlive</key>');
  });

  it('writes daemon pid and log files under CARINA_HOME', async () => {
    const mod = await daemon();
    mod.writeDaemonPid(9911);
    mod.appendDaemonLog('gateway started');
    expect(fs.readFileSync(path.join(tmp, 'daemon.pid'), 'utf8').trim()).toBe('9911');
    expect(fs.readFileSync(path.join(tmp, 'daemon.log'), 'utf8')).toContain('gateway started');
  });

  it('rotates daemon log at 10MB', async () => {
    const mod = await daemon();
    const logPath = path.join(tmp, 'daemon.log');
    fs.writeFileSync(logPath, 'x'.repeat(mod.MAX_LOG_BYTES + 1));
    mod.appendDaemonLog('after rotation');
    const files = fs.readdirSync(tmp).filter((f) => f.startsWith('daemon.log'));
    expect(files.length).toBeGreaterThanOrEqual(2);
  });

  it('reports daemon status with uptime when running', async () => {
    const mod = await daemon();
    mod.writeDaemonPid(process.pid);
    const status = mod.getDaemonStatus();
    expect(status.running).toBe(true);
    expect(status.pid).toBe(process.pid);
    expect(status.url).toContain('7430');
  });
});
