import type { Server } from 'node:http';
import crypto from 'crypto';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const WORKER_ID = '11111111-1111-4111-8111-111111111111';

const { handleParsedInbound, getWorkerChannelByWorkerAndChannel, readChannelCredentials } = vi.hoisted(() => ({
  handleParsedInbound: vi.fn(),
  getWorkerChannelByWorkerAndChannel: vi.fn(),
  readChannelCredentials: vi.fn(),
}));

vi.mock('../channels/message-router.js', () => ({
  handleParsedInbound,
}));

vi.mock('../channels/channel-store.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../channels/channel-store.js')>();
  return {
    ...actual,
    getWorkerChannelByWorkerAndChannel,
    readChannelCredentials,
  };
});

import { aivaChannelsInboundRouter } from './aiva-channels-inbound-api.js';

const SAMPLE_LINKEDIN_PAYLOAD = {
  message: {
    id: 'msg-li-1',
    from: { person: 'urn:li:person:abc123' },
    content: { text: 'Hello' },
    conversation: { id: 'urn:li:conversation:xyz789' },
  },
};

describe('aivaChannelsInboundRouter', () => {
  let port = 0;
  let server: Server;

  beforeAll(async () => {
    const app = express();
    app.use('/api/aiva/channels/inbound', aivaChannelsInboundRouter);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address();
        port = typeof address === 'object' && address ? address.port : 0;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it('returns 401 for invalid LinkedIn signature', async () => {
    vi.mocked(getWorkerChannelByWorkerAndChannel).mockResolvedValue({
      id: 'row-1',
      workerId: WORKER_ID,
      workspaceId: WORKER_ID,
      channel: 'linkedin',
      identifier: 'urn:li:person:member',
      credentials: { encrypted: 'blob' },
      enabled: true,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(readChannelCredentials).mockReturnValue({
      access_token: 'token',
      webhook_secret: 'li-webhook-secret',
      member_id: 'urn:li:person:member',
    });

    const body = JSON.stringify(SAMPLE_LINKEDIN_PAYLOAD);
    const res = await fetch(`http://127.0.0.1:${port}/api/aiva/channels/inbound/linkedin/${WORKER_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-li-signature': 'invalid',
      },
      body,
    });
    expect(res.status).toBe(401);
    expect(handleParsedInbound).not.toHaveBeenCalled();
  });

  it('invokes handleParsedInbound for valid LinkedIn webhook', async () => {
    handleParsedInbound.mockReset();
    vi.mocked(getWorkerChannelByWorkerAndChannel).mockResolvedValue({
      id: 'row-1',
      workerId: WORKER_ID,
      workspaceId: WORKER_ID,
      channel: 'linkedin',
      identifier: 'urn:li:person:member',
      credentials: { encrypted: 'blob' },
      enabled: true,
      verified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(readChannelCredentials).mockReturnValue({
      access_token: 'token',
      webhook_secret: 'li-webhook-secret',
      member_id: 'urn:li:person:member',
    });

    const body = JSON.stringify(SAMPLE_LINKEDIN_PAYLOAD);
    const signature = crypto.createHmac('sha256', 'li-webhook-secret').update(body).digest('hex');
    const res = await fetch(`http://127.0.0.1:${port}/api/aiva/channels/inbound/linkedin/${WORKER_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-li-signature': signature,
      },
      body,
    });
    expect(res.status).toBe(200);
    expect(handleParsedInbound).toHaveBeenCalledOnce();
  });
});
