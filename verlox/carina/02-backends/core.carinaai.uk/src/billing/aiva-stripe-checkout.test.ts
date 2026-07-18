import { beforeEach, describe, expect, it, vi } from 'vitest';

const checkoutCreateMock = vi.fn(async () => ({ url: 'https://checkout.stripe.test/session' }));
const poolQueryMock = vi.fn(async () => ({ rows: [{ stripe_customer_id: 'cus_1' }] }));

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
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_PRICE_AIVA_STARTER_MONTHLY = 'price_starter_monthly';
    process.env.STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY = 'price_prompt_rate_monthly';
    vi.resetModules();
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
        line_items: [{ price: 'price_starter_monthly', quantity: 1 }],
        metadata: expect.objectContaining({ product: 'aiva', workspaceId: 'ws-1', plan: 'starter' }),
        subscription_data: {
          metadata: expect.objectContaining({ product: 'aiva', workspaceId: 'ws-1', plan: 'starter' }),
        },
      }),
    );
  });

  it('creates Prompt Rate checkout from STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY', async () => {
    const { createAivaCheckoutSession } = await import('./aiva-stripe-checkout.js');
    await createAivaCheckoutSession({
      workspaceId: 'ws-luba',
      tier: 'prompt_rate',
      interval: 'month',
      successUrl: 'https://admin.hireaiva.co.uk/billing/aiva?checkout=success',
      cancelUrl: 'https://admin.hireaiva.co.uk/billing/aiva?checkout=cancel',
    });

    expect(checkoutCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_prompt_rate_monthly', quantity: 1 }],
        metadata: expect.objectContaining({
          product: 'aiva',
          workspaceId: 'ws-luba',
          plan: 'prompt_rate',
          planName: 'Aiva Prompt Rate',
        }),
      }),
    );
  });

  it('rejects Prompt Rate annual interval', async () => {
    const { createAivaCheckoutSession } = await import('./aiva-stripe-checkout.js');
    await expect(
      createAivaCheckoutSession({
        workspaceId: 'ws-1',
        tier: 'prompt_rate',
        interval: 'year',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      }),
    ).rejects.toThrow(/monthly only/i);
    expect(checkoutCreateMock).not.toHaveBeenCalled();
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
