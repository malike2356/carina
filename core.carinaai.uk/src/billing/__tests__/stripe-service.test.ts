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
    process.env.STRIPE_PRICE_SCOUT_PRO = 'price_scout';
    process.env.STRIPE_PRICE_CARINA_OPS_STARTER = 'price_ops_starter';
    process.env.STRIPE_PRICE_CARINA_OPS_TEAM = 'price_ops_team';
  });

  it('creates subscription checkout sessions with plan metadata', async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_1', url: 'https://stripe.test' });
    const service = new StripeService(stripe as never);
    const session = await service.createCheckoutSession({
      tenantId: 'tenant-1',
      email: 'user@example.com',
      plan: 'scout_pro',
      successUrl: 'https://ok',
      cancelUrl: 'https://cancel',
    });

    expect(session.id).toBe('cs_1');
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'subscription',
      customer_email: 'user@example.com',
      metadata: { tenantId: 'tenant-1', orgId: '', plan: 'scout_pro' },
    }));
  });

  it('creates Carina Ops checkout with org metadata', async () => {
    stripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_ops', url: 'https://stripe.test/ops' });
    const service = new StripeService(stripe as never);
    await service.createCheckoutSession({
      tenantId: 'tenant-1',
      orgId: 'org-1',
      email: 'owner@test.com',
      plan: 'carina_ops_starter',
      successUrl: 'https://app/ops/billing?checkout=success',
      cancelUrl: 'https://app/ops/billing?checkout=cancel',
    });

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      metadata: { tenantId: 'tenant-1', orgId: 'org-1', plan: 'carina_ops_starter' },
      line_items: [{ price: 'price_ops_starter', quantity: 1 }],
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
