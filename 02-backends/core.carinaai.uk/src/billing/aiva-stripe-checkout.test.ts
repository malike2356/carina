import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkoutCreateMock = vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' }));
const poolQueryMock = vi.fn(async () => ({ rows: [{ stripe_customer_id: 'cus_1' }] }));

vi.mock('../config/index.js', () => ({
  config: { hosted: { stripeSecretKey: 'sk_test' } },
}));

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    checkout = {
      sessions: {
        create: (...args: unknown[]) => checkoutCreateMock(...args),
      },
    };

    constructor(_secret: string) {}
  },
}));

describe('createAivaCheckoutSession', () => {
  beforeEach(() => {
    checkoutCreateMock.mockClear();
    poolQueryMock.mockClear();
    delete process.env.AIVA_BILLING_ENABLED;
    process.env.STRIPE_PRICE_AIVA_STARTER_MONTHLY = 'price_starter_monthly';
  });

  it('creates checkout with aiva metadata and automatic tax', async () => {
    const { createAivaCheckoutSession } = await import('./aiva-stripe-checkout.js');
    const result = await createAivaCheckoutSession({
      workspaceId: 'ws-1',
      tier: 'starter',
      interval: 'month',
      successUrl: 'https://admin.hireaiva.co.uk/billing/aiva?checkout=success',
      cancelUrl: 'https://admin.hireaiva.co.uk/billing/aiva?checkout=cancel',
    });

    expect(result.url).toContain('checkout.stripe.test');
    expect(checkoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        automatic_tax: { enabled: true },
        allow_promotion_codes: true,
        metadata: expect.objectContaining({ product: 'aiva', workspaceId: 'ws-1' }),
        subscription_data: {
          metadata: expect.objectContaining({ product: 'aiva', workspaceId: 'ws-1' }),
        },
      }),
    );
  });

  it('skips Stripe when billing is disabled', async () => {
    process.env.AIVA_BILLING_ENABLED = 'false';
    const { createAivaCheckoutSession } = await import('./aiva-stripe-checkout.js');
    await expect(
      createAivaCheckoutSession({
        workspaceId: 'ws-1',
        tier: 'starter',
        interval: 'month',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow(/billing is disabled/i);
    expect(checkoutCreateMock).not.toHaveBeenCalled();
  });
});
