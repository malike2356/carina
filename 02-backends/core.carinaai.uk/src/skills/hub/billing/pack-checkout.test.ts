import { beforeEach, describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';

vi.mock('../registry.js', () => ({
  getHubPack: vi.fn(),
}));

vi.mock('../migrations.js', () => ({
  hubPool: {
    query: vi.fn(),
  },
}));

vi.mock('../pack-licenses.js', () => ({
  grantPackLicense: vi.fn(async () => ({
    packName: 'premium-demo',
    token: 'pack_test_token',
    email: 'buyer@example.com',
    purchasedAt: new Date().toISOString(),
  })),
}));

vi.mock('../../../config/index.js', () => ({
  config: {
    hub: {
      stripeSecretKey: 'sk_test',
      stripeWebhookSecret: 'whsec_test',
      checkoutSuccessUrl: 'https://hub.test/success',
      checkoutCancelUrl: 'https://hub.test/cancel',
    },
  },
}));

import { getHubPack } from '../registry.js';
import { hubPool } from '../migrations.js';
import { grantPackLicense } from '../pack-licenses.js';
import {
  createPackCheckoutSession,
  handlePackCheckoutCompleted,
  recordPackSale,
} from './pack-checkout.js';

const premiumPack = {
  name: 'premium-demo',
  version: '1.0.0',
  description: 'Demo premium pack',
  author: 'VERLOX',
  category: 'demo',
  skill_count: 1,
  download_count: 0,
  featured: false,
  pricing_tier: 'premium' as const,
  price_gbp_cents: 1999,
  author_revenue_share_bps: 7000,
  carina_revenue_share_bps: 2000,
  platform_fee_bps: 1000,
  stripe_price_id: null,
  created_at: '',
  updated_at: '',
};

describe('pack-checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getHubPack).mockResolvedValue(premiumPack);
  });

  it('createPackCheckoutSession rejects non-premium packs', async () => {
    vi.mocked(getHubPack).mockResolvedValueOnce({ ...premiumPack, pricing_tier: 'free', price_gbp_cents: 0 });
    await expect(createPackCheckoutSession({
      packName: 'premium-demo',
      email: 'buyer@example.com',
    })).rejects.toThrow(/not a premium paid pack/i);
  });

  it('createPackCheckoutSession returns stripe checkout url', async () => {
    const stripe = {
      checkout: {
        sessions: {
          create: vi.fn(async () => ({ id: 'cs_test', url: 'https://checkout.stripe.test/session' })),
        },
      },
    } as unknown as Stripe;

    const result = await createPackCheckoutSession({
      packName: 'premium-demo',
      email: 'buyer@example.com',
    }, stripe);

    expect(result.url).toContain('checkout.stripe.test');
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({ checkoutType: 'hub_pack', packName: 'premium-demo' }),
      }),
    );
  });

  it('handlePackCheckoutCompleted grants license and records sale', async () => {
    vi.mocked(hubPool.query).mockResolvedValue({ rows: [], rowCount: 0 } as never);

    const session = {
      id: 'cs_test_done',
      payment_status: 'paid',
      amount_total: 1999,
      metadata: {
        checkoutType: 'hub_pack',
        packName: 'premium-demo',
        purchaserEmail: 'buyer@example.com',
      },
    } as Stripe.Checkout.Session;

    const license = await handlePackCheckoutCompleted(session);
    expect(license?.token).toBe('pack_test_token');
    expect(grantPackLicense).toHaveBeenCalledWith({
      packName: 'premium-demo',
      email: 'buyer@example.com',
      stripeSessionId: 'cs_test_done',
    });
    expect(hubPool.query).toHaveBeenCalled();
  });

  it('recordPackSale is idempotent', async () => {
    vi.mocked(hubPool.query)
      .mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 } as never);

    await recordPackSale({
      packName: 'premium-demo',
      email: 'buyer@example.com',
      amountGbpCents: 1999,
      stripeSessionId: 'cs_dup',
    });

    expect(hubPool.query).toHaveBeenCalledTimes(1);
  });
});
