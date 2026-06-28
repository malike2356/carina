import { describe, expect, it, vi, beforeEach } from 'vitest';

const poolQueryMock = vi.fn();
const stripeCancelMock = vi.fn(async () => ({ id: 'sub_1' }));

vi.mock('../config/index.js', () => ({
  config: { hosted: { stripeSecretKey: 'sk_test' } },
}));

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    subscriptions = {
      cancel: (...args: unknown[]) => stripeCancelMock(...args),
    };

    constructor(_secret: string) {}
  },
}));

describe('cancelAivaStripeSubscriptionForWorkspace', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    stripeCancelMock.mockClear();
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    delete process.env.AIVA_BILLING_ENABLED;
  });

  it('cancels Stripe subscription and marks workspace cancelled', async () => {
    poolQueryMock
      .mockResolvedValueOnce({ rows: [{ stripe_subscription_id: 'sub_live_1' }] })
      .mockResolvedValueOnce({ rowCount: 1 });

    const { cancelAivaStripeSubscriptionForWorkspace } = await import('./aiva-billing-store.js');
    await cancelAivaStripeSubscriptionForWorkspace('ws-1');

    expect(stripeCancelMock).toHaveBeenCalledWith('sub_live_1');
    expect(poolQueryMock).toHaveBeenCalledTimes(2);
  });

  it('skips Stripe when billing is disabled', async () => {
    process.env.AIVA_BILLING_ENABLED = 'false';

    const { cancelAivaStripeSubscriptionForWorkspace } = await import('./aiva-billing-store.js');
    await cancelAivaStripeSubscriptionForWorkspace('ws-1');

    expect(poolQueryMock).not.toHaveBeenCalled();
    expect(stripeCancelMock).not.toHaveBeenCalled();
  });
});
