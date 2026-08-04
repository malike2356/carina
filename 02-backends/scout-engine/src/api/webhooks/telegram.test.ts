import assert from 'node:assert/strict';
import { after, describe, it } from 'node:test';
import express from 'express';
import { createServer } from 'node:http';
import { telegramWebhookRouter } from './telegram.js';
import { pool } from '../../event-server/db.js';

describe('telegram webhook', () => {
  after(async () => {
    await pool.end().catch(() => undefined);
  });

  it('rejects requests without the secret token', async () => {
    const app = express();
    app.use(express.json());
    app.use('/webhooks/telegram', telegramWebhookRouter);
    const server = createServer(app);

    await new Promise<void>((resolve) => server.listen(0, resolve));
    server.unref();
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected ephemeral port');

    process.env.TELEGRAM_WEBHOOK_SECRET = 'secret-1';
    const response = await fetch(`http://127.0.0.1:${address.port}/webhooks/telegram`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Connection: 'close' },
      body: JSON.stringify({ update_id: 1 }),
    });

    assert.equal(response.status, 401);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
      (server as typeof server & { closeIdleConnections?: () => void; closeAllConnections?: () => void }).closeIdleConnections?.();
      (server as typeof server & { closeAllConnections?: () => void }).closeAllConnections?.();
    });
  });
});
