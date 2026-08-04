import { describe, expect, it, beforeEach } from 'vitest';
import {
  invalidateBillingConfigCache,
} from '../billing-config.js';
import {
  getStripeBillingClient,
  resetStripeBillingClient,
  resolveStripeSecretKey,
} from '../billing-stripe-client.js';

describe('billing-stripe-client', () => {
  beforeEach(() => {
    invalidateBillingConfigCache();
    resetStripeBillingClient();
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('resolveStripeSecretKey reads env fallback when cache is empty', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_env';
    expect(resolveStripeSecretKey()).toBe('sk_test_env');
  });

  it('returns a new client after resetStripeBillingClient', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_one';
    const first = getStripeBillingClient();
    resetStripeBillingClient();
    const second = getStripeBillingClient();
    expect(first).not.toBe(second);
  });
});
