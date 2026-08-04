import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../memory/db.js', () => ({ pool: { query } }));

describe('SubscriptionManager', () => {
  beforeEach(() => query.mockReset());

  it('issues Scout API keys with the expected prefix', async () => {
    const { issueScoutApiKey } = await import('../subscription-manager.js');
    expect(issueScoutApiKey()).toMatch(/^scout_live_[a-f0-9]{48}$/);
  });

  it('cancels in Stripe and locally', async () => {
    const { SubscriptionManager } = await import('../subscription-manager.js');
    query
      .mockResolvedValueOnce({ rows: [{ tenant_id: 't1', stripe_subscription_id: 'sub_1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ tenant_id: 't1', status: 'canceled' }] });
    const stripe = { cancelSubscription: vi.fn().mockResolvedValue({ id: 'sub_1' }) };
    const manager = new SubscriptionManager(stripe as never);

    await manager.cancel('t1');

    expect(stripe.cancelSubscription).toHaveBeenCalledWith('sub_1');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE subscriptions SET status'), ['canceled', 't1']);
  });
});
