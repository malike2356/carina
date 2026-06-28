import type { Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { propreneurHubReplyRouter } from './propreneur-hub-reply-api.js';
import { drainWebReplies } from '../channels/adapters/web-adapter.js';

describe('propreneurHubReplyRouter', () => {
  const originalSecret = process.env.CARINA_HUB_WEBHOOK_SECRET;
  let port = 0;
  let server: Server;

  beforeAll(async () => {
    process.env.CARINA_HUB_WEBHOOK_SECRET = 'test-hub-secret';
    const app = express();
    app.use('/api/webhooks', propreneurHubReplyRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    process.env.CARINA_HUB_WEBHOOK_SECRET = originalSecret;
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns 401 for invalid hub key', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/propreneur-reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: 's1', reply: 'hello' }),
    });
    expect(res.status).toBe(401);
  });

  it('queues reply for session when key is valid', async () => {
    const res = await fetch(`http://127.0.0.1:${port}/api/webhooks/propreneur-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Carina-Hub-Key': 'test-hub-secret',
      },
      body: JSON.stringify({ session_id: 'hub_sess_test', reply: 'Portfolio summary ready.' }),
    });
    expect(res.status).toBe(200);
    expect(drainWebReplies('hub_sess_test')).toEqual(['Portfolio summary ready.']);
  });
});
