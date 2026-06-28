import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

vi.mock('../stripe-service.js', () => ({
  StripeService: class {
    getSubscription = vi.fn(async () => ({
      metadata: { product: 'aiva', workspaceId: 'ws-1' },
    }));
  },
}));

vi.mock('../aiva-stripe-metadata.js', () => ({
  isAivaProductMetadata: (metadata: { product?: string } | null) => metadata?.product === 'aiva',
  resolveWorkspaceIdFromInvoice: vi.fn(async () => 'ws-1'),
  subscriptionIdFromInvoice: () => 'sub_aiva',
}));

import { isAivaStripeEvent } from './aiva-stripe-events.js';

describe('isAivaStripeEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true for checkout with product=aiva metadata', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { product: 'aiva', workspaceId: 'ws-1' } } },
    } as Stripe.Event;
    await expect(isAivaStripeEvent(event)).resolves.toBe(true);
  });

  it('returns false for carina checkout metadata', async () => {
    const event = {
      type: 'checkout.session.completed',
      data: { object: { metadata: { tenantId: 't-1', plan: 'carina_ops_starter' } } },
    } as Stripe.Event;
    await expect(isAivaStripeEvent(event)).resolves.toBe(false);
  });

  it('returns true for aiva subscription updates', async () => {
    const event = {
      type: 'customer.subscription.updated',
      data: { object: { metadata: { product: 'aiva', workspaceId: 'ws-1' } } },
    } as Stripe.Event;
    await expect(isAivaStripeEvent(event)).resolves.toBe(true);
  });
});
