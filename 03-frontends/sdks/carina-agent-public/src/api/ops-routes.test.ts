import express from 'express';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import type { Server } from 'http';
import { mountOpsRoutes } from './ops-routes.js';

describe('ops-routes', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    process.env.CARINA_OPS_TOKEN = 'test-ops-token-123456';
    const app = express();
    app.use(express.json());
    mountOpsRoutes(app);
    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    delete process.env.CARINA_OPS_TOKEN;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('rejects reload without token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/reload-secrets`, {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });

  it('reloads secrets with bearer token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/reload-secrets`, {
      method: 'POST',
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
