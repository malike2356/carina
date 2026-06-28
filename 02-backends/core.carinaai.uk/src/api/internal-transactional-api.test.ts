import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';

const sendPasswordResetEmailMock = vi.fn(async () => undefined);

vi.mock('../email/email-triggers.js', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

describe('internal-transactional-api', () => {
  const originalKey = process.env.CARINA_INTERNAL_KEY;

  beforeEach(() => {
    sendPasswordResetEmailMock.mockClear();
    process.env.CARINA_INTERNAL_KEY = 'test-internal-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.CARINA_INTERNAL_KEY;
    else process.env.CARINA_INTERNAL_KEY = originalKey;
  });

  async function startServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
    const { internalTransactionalApiRouter } = await import('./internal-transactional-api.js');
    const app = express();
    app.use(express.json());
    app.use('/api/internal/transactional', internalTransactionalApiRouter);
    const server: Server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    return {
      baseUrl: `http://127.0.0.1:${port}`,
      close: () => new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
    };
  }

  it('rejects requests without internal key', async () => {
    const { baseUrl, close } = await startServer();
    const res = await fetch(`${baseUrl}/api/internal/transactional/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', resetUrl: 'https://app.test/reset' }),
    });
    await close();
    expect(res.status).toBe(401);
  });

  it('sends password reset email when authorized', async () => {
    const { baseUrl, close } = await startServer();
    const res = await fetch(`${baseUrl}/api/internal/transactional/password-reset`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-key': 'test-internal-key',
      },
      body: JSON.stringify({
        email: 'user@example.com',
        resetUrl: 'https://app.test/reset?token=abc',
        expiresInMinutes: 60,
      }),
    });
    await close();
    expect(res.status).toBe(200);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      resetUrl: 'https://app.test/reset?token=abc',
      expiresInMinutes: 60,
    });
  });
});
