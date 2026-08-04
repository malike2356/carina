import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import os from 'os';
import { resetNodeSocketHub } from './node-ws-hub.js';

const tmpHome = path.join(os.tmpdir(), `carina-node-routes-${process.pid}`);

describe('node-host routes', () => {
  let server: ReturnType<express.Application['listen']> | null = null;
  let port = 0;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('../../ops/ops-config.js', () => ({
      opsToken: () => 'ops-test-token',
      sandboxImage: () => 'alpine:latest',
      sandboxMemoryMb: () => 256,
      debugProxyPort: () => 19229,
      SANDBOX_LABEL: 'carina.sandbox',
      SANDBOX_NAME_PREFIX: 'carina-sandbox-',
    }));
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_NODE_HOST_ENABLED = 'true';
    process.env.CARINA_OPS_TOKEN = 'ops-test-token';
    process.env.CARINA_INTERNAL_KEY = 'ops-test-token';
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    delete process.env.CARINA_HOME;
    delete process.env.CARINA_NODE_HOST_ENABLED;
    delete process.env.CARINA_OPS_TOKEN;
    delete process.env.CARINA_INTERNAL_KEY;
    await fs.rm(tmpHome, { recursive: true, force: true });
  });

  async function startApp() {
    const { mountNodeHostRoutes } = await import('./routes.js');
    const app = express();
    app.use(express.json());
    mountNodeHostRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const addr = server!.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  }

  it('pair request, approve, claim, and auth failure after revoke', async () => {
    await startApp();
    const base = `http://127.0.0.1:${port}`;

    const req = await fetch(`${base}/api/nodes/pair/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'remote', hostname: 'remote', platform: 'linux' }),
    });
    const pending = await req.json() as { pendingId: string; code: string };

    const approve = await fetch(`${base}/api/nodes/pair/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ops-test-token',
        'x-internal-key': 'ops-test-token',
      },
      body: JSON.stringify({ pendingId: pending.pendingId }),
    });
    expect(approve.ok).toBe(true);

    const claim = await fetch(`${base}/api/nodes/pair/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId: pending.pendingId, code: pending.code }),
    });
    const creds = await claim.json() as { token: string; nodeId: string };
    expect(creds.token).toMatch(/^cnh_/);

    const poll = await fetch(`${base}/api/nodes/commands/poll`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    expect(poll.ok).toBe(true);

    const revoke = await fetch(`${base}/api/nodes/${creds.nodeId}/revoke`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ops-test-token' },
    });
    expect(revoke.ok).toBe(true);

    const pollFail = await fetch(`${base}/api/nodes/commands/poll`, {
      headers: { Authorization: `Bearer ${creds.token}` },
    });
    expect(pollFail.status).toBe(401);
  });

  it('blocks dangerous shell dispatch before queueing', async () => {
    await startApp();
    const base = `http://127.0.0.1:${port}`;

    const req = await fetch(`${base}/api/nodes/pair/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'remote', hostname: 'remote', platform: 'linux' }),
    });
    const pending = await req.json() as { pendingId: string; code: string };

    await fetch(`${base}/api/nodes/pair/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ops-test-token',
        'x-internal-key': 'ops-test-token',
      },
      body: JSON.stringify({ pendingId: pending.pendingId }),
    });

    const claim = await fetch(`${base}/api/nodes/pair/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId: pending.pendingId, code: pending.code }),
    });
    const creds = await claim.json() as { token: string; nodeId: string };

    const blocked = await fetch(`${base}/api/nodes/${creds.nodeId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ops-test-token',
        'x-internal-key': 'ops-test-token',
      },
      body: JSON.stringify({ type: 'shell', payload: { command: 'rm -rf /' } }),
    });
    expect(blocked.status).toBe(403);
    const body = await blocked.json() as { code?: string };
    expect(body.code).toBe('NODE_SHELL_BLOCKED');
  });

  it('returns poll transport when node is not on websocket', async () => {
    await startApp();
    const base = `http://127.0.0.1:${port}`;
    resetNodeSocketHub();

    const req = await fetch(`${base}/api/nodes/pair/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'remote', hostname: 'remote', platform: 'linux' }),
    });
    const pending = await req.json() as { pendingId: string; code: string };

    await fetch(`${base}/api/nodes/pair/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ops-test-token',
        'x-internal-key': 'ops-test-token',
      },
      body: JSON.stringify({ pendingId: pending.pendingId }),
    });

    const claim = await fetch(`${base}/api/nodes/pair/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingId: pending.pendingId, code: pending.code }),
    });
    const creds = await claim.json() as { token: string; nodeId: string };

    const dispatch = await fetch(`${base}/api/nodes/${creds.nodeId}/command`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ops-test-token',
        'x-internal-key': 'ops-test-token',
      },
      body: JSON.stringify({ type: 'ping', payload: {} }),
    });
    const body = await dispatch.json() as { transport?: string };
    expect(body.transport).toBe('poll');
  });
});
