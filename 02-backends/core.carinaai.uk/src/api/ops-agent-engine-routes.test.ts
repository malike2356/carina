import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Server } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountOpsAgentEngineRoutes } from './ops-agent-engine-routes.js';
import { resetAgentEngineStateForTests } from '../ops/agent-engine/store.js';

describe('ops agent-engine routes (C05)', () => {
  let server: Server;
  let port: number;
  let prevHome: string | undefined;
  let tmpHome: string;

  beforeEach(async () => {
    prevHome = process.env.CARINA_HOME;
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-agent-engine-'));
    process.env.CARINA_HOME = tmpHome;
    process.env.CARINA_DATA_DIR = path.join(tmpHome, 'data');
    process.env.CARINA_OPS_TOKEN = 'test-ops-token-123456';
    process.env.CARINA_KEPRIX_URL = 'http://127.0.0.1:9';
    resetAgentEngineStateForTests({
      config: {
        global_engine: 'keprix',
        keprix_url: 'http://127.0.0.1:9',
        default_model: 'deepseek-v4-pro',
        max_iterations: 10,
        timeout_seconds: 30,
        prompt_filter_enabled: true,
        kill_switch_enabled: true,
        scout_integration_enabled: true,
      },
      workspaces: {
        ws_salim: { name: 'Salim', engine: 'keprix', status: 'active' },
        ws_test: { name: 'Test', engine: 'carina', status: 'active' },
      },
    });

    const app = express();
    app.use(express.json());
    mountOpsAgentEngineRoutes(app);
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
    delete process.env.CARINA_KEPRIX_URL;
    if (prevHome === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = prevHome;
    delete process.env.CARINA_DATA_DIR;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    try {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('rejects unauthenticated health', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/health`);
    expect(res.status).toBe(401);
  });

  it('returns config and workspaces', async () => {
    const headers = { authorization: 'Bearer test-ops-token-123456' };
    const configRes = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/config`, { headers });
    expect(configRes.status).toBe(200);
    const config = await configRes.json() as { global_engine: string; default_model: string };
    expect(config.global_engine).toBe('keprix');
    expect(config.default_model).toBe('deepseek-v4-pro');

    const wsRes = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/workspaces`, { headers });
    expect(wsRes.status).toBe(200);
    const body = await wsRes.json() as {
      workspaces: Array<{ id: string; engine: string }>;
      summary: { total: number; on_keprix: number; on_carina: number };
    };
    expect(body.summary.total).toBe(2);
    expect(body.summary.on_keprix).toBe(1);
    expect(body.summary.on_carina).toBe(1);
  });

  it('switches workspace engine and emergency rollback', async () => {
    const headers = {
      authorization: 'Bearer test-ops-token-123456',
      'content-type': 'application/json',
    };
    const switchRes = await fetch(
      `http://127.0.0.1:${port}/api/ops/agent-engine/workspaces/ws_test/switch`,
      { method: 'POST', headers, body: JSON.stringify({ engine: 'keprix' }) },
    );
    expect(switchRes.status).toBe(200);
    const switched = await switchRes.json() as { engine: string };
    expect(switched.engine).toBe('keprix');

    const rollback = await fetch(
      `http://127.0.0.1:${port}/api/ops/agent-engine/emergency-rollback`,
      { method: 'POST', headers, body: '{}' },
    );
    expect(rollback.status).toBe(200);
    const rolled = await rollback.json() as { engine: string };
    expect(rolled.engine).toBe('carina');

    const configRes = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/config`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    const config = await configRes.json() as { global_engine: string };
    expect(config.global_engine).toBe('carina');
  });

  it('records deploy restart with downtime estimate', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/deploy`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ action: 'restart' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as {
      action: string;
      status: string;
      estimated_downtime_seconds: number;
    };
    expect(body.action).toBe('restart');
    expect(body.status).toBe('initiated');
    expect(body.estimated_downtime_seconds).toBe(5);
  });

  it('patches config', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/config`, {
      method: 'PATCH',
      headers: {
        authorization: 'Bearer test-ops-token-123456',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ default_model: 'gemini-2.5-pro', max_iterations: 15 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { default_model: string; max_iterations: number };
    expect(body.default_model).toBe('gemini-2.5-pro');
    expect(body.max_iterations).toBe(15);
  });

  it('returns logs payload', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/ops/agent-engine/logs?limit=10`, {
      headers: { authorization: 'Bearer test-ops-token-123456' },
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { logs: unknown[] };
    expect(Array.isArray(body.logs)).toBe(true);
  });
});
