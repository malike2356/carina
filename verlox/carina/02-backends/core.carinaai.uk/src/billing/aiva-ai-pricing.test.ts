import { describe, expect, it } from 'vitest';
import {
  AIVA_AI_MARKUP,
  AIVA_FALLBACK_PRICING,
  chargedPenceForRun,
  estimateManagedCallPence,
  pricingForModel,
  rawProviderCostGbp,
} from './aiva-ai-pricing.js';

describe('aiva-ai-pricing', () => {
  it('uses known model rates', () => {
    expect(pricingForModel('gpt-4o-mini')).toEqual({ in: 0.12, out: 0.48 });
  });

  it('falls back conservatively for unknown models', () => {
    expect(pricingForModel('totally-unknown-model-xyz')).toEqual(AIVA_FALLBACK_PRICING);
  });

  it('charges at least 1 pence and applies markup', () => {
    const pence = chargedPenceForRun('gpt-4o-mini', { inputTokens: 1000, outputTokens: 500 });
    const raw = rawProviderCostGbp('gpt-4o-mini', { inputTokens: 1000, outputTokens: 500 });
    expect(pence).toBeGreaterThanOrEqual(1);
    expect(pence).toBe(Math.max(1, Math.ceil(raw * AIVA_AI_MARKUP * 100)));
  });

  it('estimates pre-call cost without undercharging', () => {
    const estimate = estimateManagedCallPence('unknown-frontier', 4_000);
    expect(estimate).toBeGreaterThanOrEqual(1);
    expect(pricingForModel('unknown-frontier')).toEqual(AIVA_FALLBACK_PRICING);
  });
});
