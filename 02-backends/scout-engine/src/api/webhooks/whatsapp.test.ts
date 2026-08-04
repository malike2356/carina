import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, describe, it } from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { whatsappWebhookRouter } from './whatsapp.js';
import { pool } from '../../event-server/db.js';

function withRawBody(app = express()) {
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }));
  app.use('/webhooks/whatsapp', whatsappWebhookRouter);
  return app;
}

describe('whatsapp webhook', () => {
  after(async () => {
    await pool.end().catch(() => undefined);
  });

  it('returns the verification challenge when the token matches', async () => {
    process.env.SCOUT_WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_VERIFY_TOKEN = 'verify-123';

    const app = withRawBody();
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    server.unref();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected ephemeral port');

    const response = await fetch(
      `http://127.0.0.1:${address.port}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-123&hub.challenge=abc123`,
      { headers: { Connection: 'close' } },
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'abc123');

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  });

  it('rejects an invalid signature', async () => {
    process.env.SCOUT_WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_APP_SECRET = 'secret-123';

    const app = withRawBody();
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    server.unref();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected ephemeral port');

    const payload = JSON.stringify({ entry: [] });
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Hub-Signature-256': 'sha256=deadbeef',
        Connection: 'close',
      },
      body: payload,
    });

    assert.equal(response.status, 401);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  });

  it('accepts a valid signature', async () => {
    process.env.SCOUT_WHATSAPP_ENABLED = 'true';
    process.env.WHATSAPP_APP_SECRET = 'secret-123';

    const app = withRawBody();
    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    server.unref();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected ephemeral port');

    const payload = JSON.stringify({ entry: [] });
    const signature = crypto.createHmac('sha256', 'secret-123').update(payload).digest('hex');
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/whatsapp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Hub-Signature-256': `sha256=${signature}`,
        Connection: 'close',
      },
      body: payload,
    });

    assert.equal(response.status, 200);
    const body = await response.json() as any;
    assert.equal(body.ok, true);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  });
});

