import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StripeService } from '../stripe-service.js';

const stripe = {
  checkout: { sessions: { create: vi.fn() } },
  webhooks: { constructEvent: vi.fn() },
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
  billingPortal: { sessions: { create: vi.fn() } },
};

describe('StripeService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_PRICE_SCOUT_STANDARD = 'price_scout';
  });

  it('creates subscription checkout sessions with plan metadata', async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' });
    const service = new StripeService(stripe as never);
    const session = await service.createCheckoutSession({
      tenantId: 'tenant-1',
      email: 'user@example.com',
      plan: 'scout_standard',
      successUrl: 'https://ok',
      cancelUrl: 'https://cancel',
    });

    expect(session.id).toBe('cs_1');
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer_email: 'user@example.com',
      metadata: { tenantId: 'tenant-1', plan: 'scout_standard' },
    }));
  });

  it('verifies webhooks with STRIPE_WEBHOOK_SECRET', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    stripe.webhooks.constructEvent.mockReturnValue({ id: 'evt_1' });
    const service = new StripeService(stripe as never);
    expect(service.handleWebhook(Buffer.from('{}'), 'sig')).toEqual({ id: 'evt_1' });
    expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(Buffer.from('{}'), 'sig', 'whsec_test');
  });
});
