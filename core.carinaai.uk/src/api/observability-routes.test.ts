import express from 'express';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Server } from 'http';
import { mountObservabilityRoutes } from './observability-routes.js';

describe('observability-routes', () => {
  let server: Server;
  let port: number;

  beforeEach(async () => {
    process.env.CARINA_OPS_TOKEN = 'test-ops-token-123456';
    const app = express();
    mountObservabilityRoutes(app);
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

  it('rejects logs without token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/logs`);
    expect(res.status).toBe(401);
  });

  it('returns logs with bearer token', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/logs`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: unknown[] };
    expect(Array.isArray(body.logs)).toBe(true);
  });

  it('returns session overview', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/sessions`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { sessions: unknown[]; summary: { total: number } };
    expect(Array.isArray(body.sessions)).toBe(true);
    expect(typeof body.summary.total).toBe('number');
  });

  it('returns telemetry health snapshot', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/telemetry/health`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { healthy: boolean; checks: unknown[] };
    expect(typeof body.healthy).toBe('boolean');
    expect(Array.isArray(body.checks)).toBe(true);
  });

  it('returns telemetry usage metrics', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/telemetry/metrics`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { metrics: { turns: { total: number } } };
    expect(body.metrics.turns).toBeDefined();
  });
});
