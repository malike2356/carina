import express from 'express';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/index.js', () => ({
  config: {
    resend: {
      apiKey: 'test-key',
      from: 'Carina <noreply@carinaai.uk>',
    },
  },
}));

const send = vi.fn().mockResolvedValue({ id: 'msg_1' });

vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

async function post(body: Record<string, unknown>) {
  const { bookDemoRouter } = await import('./book-demo.js');
  const app = express();
  app.use(express.json());
  app.use('/api/book-demo', bookDemoRouter);
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Failed to bind test server');
  }
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/book-demo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as Record<string, unknown>;
    return { status: res.status, json };
  } finally {
    server.close();
  }
}

describe('bookDemoRouter', () => {
  beforeEach(() => {
    send.mockClear();
    vi.resetModules();
  });

  it('rejects missing fields', async () => {
    const result = await post({ name: 'Ada', email: 'ada@example.com' });
    expect(result.status).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });

  it('sends a demonstration request email', async () => {
    const result = await post({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      business: 'Analytical Engines Ltd',
      task: 'Triage customer email every morning',
      preferredTime: 'Thursday afternoon',
    });
    expect(result.status).toBe(200);
    expect(result.json.ok).toBe(true);
    expect(result.json.emailed).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0]![0]).toMatchObject({
      to: 'contact@verlox.uk',
      replyTo: 'ada@example.com',
      subject: 'Book a live demonstration (carinaai.uk): Analytical Engines Ltd',
    });
  });
});
