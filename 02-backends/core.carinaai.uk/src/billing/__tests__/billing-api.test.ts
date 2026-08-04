import express from 'express';
import type { AddressInfo } from 'net';
import { describe, expect, it, vi } from 'vitest';
import { BillingApi } from '../billing-api.js';

vi.mock('../../api/hosted-auth.js', () => ({
  registerUser: vi.fn().mockResolvedValue({ userId: 'tenant-1', apiKey: 'carina_key' }),
  loginUser: vi.fn(),
  verifyJwt: vi.fn((token: string) => token === 'ok' ? { userId: 'tenant-1', email: 'user@example.com' } : null),
  getUserProfile: vi.fn().mockResolvedValue({ tier: 'pro' }),
}));

describe('BillingApi', () => {
  async function withServer(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
    const server = app.listen(0);
    try {
      const address = server.address() as AddressInfo;
      await fn(`http://127.0.0.1:${address.port}`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }

  it('requires authenticated tenant access for subscription routes', async () => {
    const app = express();
    app.use('/api/billing', new BillingApi({} as never, {} as never, {} as never, {} as never).router);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/billing/subscription`);
      expect(res.status).toBe(401);
    });
  });

  it('creates checkout sessions through StripeService', async () => {
    const stripe = { createCheckoutSession: vi.fn().mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' }) };
    const app = express();
    app.use('/api/billing', new BillingApi(stripe as never, {} as never, {} as never, {} as never).router);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/billing/checkout/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'user@example.com', password: 'password1', plan: 'scout_standard' }),
      });
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toMatchObject({ url: 'https://stripe.test' });
    });
  });
});
