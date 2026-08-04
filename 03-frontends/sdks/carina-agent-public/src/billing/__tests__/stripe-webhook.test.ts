import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../memory/db.js', () => ({ pool: { query } }));

describe('StripeWebhookHandler', () => {
  beforeEach(() => query.mockReset());

  it('rejects replayed events idempotently', async () => {
    const { StripeWebhookHandler } = await import('../webhooks/stripe-webhook.js');
    query.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'evt_1' }] });
    const handler = new StripeWebhookHandler({} as never, {} as never, {} as never);

    await handler.handleEvent({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } } as never);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('dispatches checkout completion to subscription sync', async () => {
    const { StripeWebhookHandler } = await import('../webhooks/stripe-webhook.js');
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] }).mockResolvedValueOnce({ rows: [] });
    const subscriptions = { syncFromCheckoutSession: vi.fn().mockResolvedValue(undefined) };
    const handler = new StripeWebhookHandler({} as never, subscriptions as never, {} as never);

    await handler.handleEvent({ id: 'evt_2', type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } } as never);

    expect(subscriptions.syncFromCheckoutSession).toHaveBeenCalledWith({ id: 'cs_1' });
  });
});
