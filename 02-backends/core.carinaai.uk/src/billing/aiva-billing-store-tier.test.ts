import { afterEach, describe, expect, it } from 'vitest';
import { tierFromPriceId } from './aiva-billing-store.js';

describe('tierFromPriceId prompt_rate', () => {
  afterEach(() => {
    delete process.env.STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY;
  });

  it('maps STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY to prompt_rate', () => {
    process.env.STRIPE_PRICE_AIVA_PROMPT_RATE_MONTHLY = 'price_prompt_rate_test';
    expect(tierFromPriceId('price_prompt_rate_test')).toEqual({
      tier: 'prompt_rate',
      interval: 'month',
    });
  });
});
