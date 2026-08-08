/**
 * Tests for Carina southbound Keprix product API (CAS-03).
 */
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mountKeprixProductApi } from './keprix-product-api.js';

describe('keprix product API (CAS-03)', () => {
  const prev = process.env.CARINA_KEPRIX_SHARED_TOKEN;
  let base = '';
  let server: ReturnType<typeof createServer>;

  before(async () => {
    process.env.CARINA_KEPRIX_SHARED_TOKEN = 'test-shared';
    const app = express();
    app.use(express.json());
    mountKeprixProductApi(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    if (!addr || typeof addr === 'string') throw new Error('no port');
    base = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
    if (prev === undefined) delete process.env.CARINA_KEPRIX_SHARED_TOKEN;
    else process.env.CARINA_KEPRIX_SHARED_TOKEN = prev;
  });

  it('health is public', async () => {
    const res = await fetch(`${base}/api/keprix/v1/health`);
    assert.equal(res.status, 200);
  });

  it('context strips secrets', async () => {
    const res = await fetch(`${base}/api/keprix/v1/context?workspace_id=w1`, {
      headers: { Authorization: 'Bearer test-shared' },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.workspace_id, 'w1');
    assert.equal(body.password, undefined);
    assert.equal(body.token, undefined);
  });

  it('propose apply requires approval and is idempotent', async () => {
    const headers = {
      Authorization: 'Bearer test-shared',
      'Content-Type': 'application/json',
      'Idempotency-Key': 'idem-1',
    };
    const denied = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    assert.equal(denied.status, 403);

    const a = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ approval_id: 'ap1' }),
    });
    const b = await fetch(`${base}/api/keprix/v1/crm/propose/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ approval_id: 'ap1' }),
    });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.deepEqual(await a.json(), await b.json());
  });
});
