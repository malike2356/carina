import express from 'express';
import type { AddressInfo } from 'net';
import { describe, expect, it } from 'vitest';
import { mountBillingRoutes, mountBillingWebhook } from '../billing-routes.js';

describe('billing route registration', () => {
  it('mounts billing plan routes', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const app = express();
    mountBillingRoutes(app);
    const server = app.listen(0);
    try {
      const address = server.address() as AddressInfo;
      const res = await fetch(`http://127.0.0.1:${address.port}/api/billing/plans`);
      expect(res.status).toBe(200);
      const body = await res.json() as { plans: unknown[] };
      expect(body.plans.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('registers canonical and legacy Stripe webhook paths', async () => {
    const app = express();
    mountBillingWebhook(app);
    const server = app.listen(0);
    try {
      const address = server.address() as AddressInfo;
      const base = `http://127.0.0.1:${address.port}`;
      const canonical = await fetch(`${base}/webhooks/stripe`, { method: 'POST', body: '{}' });
      const legacy = await fetch(`${base}/api/billing/stripe/webhook`, { method: 'POST', body: '{}' });
      expect(canonical.status).not.toBe(404);
      expect(legacy.status).not.toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
