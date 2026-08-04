import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('control-routes', () => {
  let server: Server;
  let port = 0;
  let tmp = '';

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-control-'));
    vi.resetModules();
    process.env.CARINA_HOME = tmp;
    process.env.CARINA_OPS_TOKEN = 'test-ops-token-123456';

    const { mountControlRoutes } = await import('./control-routes.js');
    const { mountPairingRoutes } = await import('./pairing-routes.js');
    const app = express();
    app.use(express.json());
    mountControlRoutes(app, '1.2.3');
    mountPairingRoutes(app);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_OPS_TOKEN;
    fs.rmSync(tmp, { recursive: true, force: true });
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects control status without auth', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/control/status`);
    expect(res.status).toBe(401);
  });

  it('returns host status with ops bearer token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/control/status`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; host: { version: string } };
    expect(body.ok).toBe(true);
    expect(body.host.version).toBe('1.2.3');
  });

  it('creates pairing code and claims device', async () => {
    const codeRes = await fetch(`http://127.0.0.1:${port}/api/pairing/code`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(codeRes.status).toBe(200);
    const codeBody = await codeRes.json() as { code: string };
    expect(codeBody.code).toBeTruthy();

    const claimRes = await fetch(`http://127.0.0.1:${port}/api/pairing/claim`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: codeBody.code, name: 'Mobile', platform: 'ios' }),
    });
    expect(claimRes.status).toBe(200);
    const claimBody = await claimRes.json() as { token: string; deviceId: string };
    expect(claimBody.token).toMatch(/^cdv_/);

    const devicesRes = await fetch(`http://127.0.0.1:${port}/api/control/devices`, {
      headers: { authorization: `Bearer ${claimBody.token}` },
    });
    expect(devicesRes.status).toBe(200);
    const devicesBody = await devicesRes.json() as { devices: Array<{ id: string }> };
    expect(devicesBody.devices.some((d) => d.id === claimBody.deviceId)).toBe(true);
  });
});
