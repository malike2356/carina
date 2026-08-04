import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const engineJson = vi.fn();
const engineProxy = vi.fn();

vi.mock('../../lib/scout-engine-client.js', () => ({
  requestScoutEngineJson: (...args: unknown[]) => engineJson(...args),
  proxyScoutEngineJson: (...args: unknown[]) => engineProxy(...args),
}));

import { dashboardChannelsRouter } from '../channels.js';

describe('dashboard channels router', () => {
  beforeEach(() => {
    engineJson.mockReset();
    engineProxy.mockReset();
    process.env.SCOUT_ENGINE_URL = 'http://engine.test';
  });

  afterEach(() => {
    delete process.env.SCOUT_ENGINE_URL;
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).scoutAuth = { kind: 'account', accountId: 'org-1' };
      next();
    });
    app.use('/api/dashboard/channels', dashboardChannelsRouter);
    return app;
  }

  it('proxies list requests to the engine', async () => {
    engineJson.mockResolvedValue({
      status: 200,
      text: JSON.stringify({ ok: true, links: [] }),
      contentType: 'application/json',
    });

    const res = await request(makeApp()).get('/api/dashboard/channels');
    assert.equal(res.status, 200);
    assert.deepEqual(JSON.parse(res.text), { ok: true, links: [] });
    assert.equal(engineJson.mock.calls.length, 1);
  });

  it('proxies link-code creation to the engine', async () => {
    engineProxy.mockImplementation(async (_req: unknown, res: any) => {
      res.status(200).json({ ok: true });
      return true;
    });

    const res = await request(makeApp())
      .post('/api/dashboard/channels/telegram/link-code')
      .send({ role: 'operator' });

    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
    assert.equal(engineProxy.mock.calls.length, 1);
  });
});
