import { describe, expect, it } from 'vitest';
import { getSignupPromo, listSignupPromoCodes, normalizeSignupSource } from './signup-promo.js';

describe('signup-promo', () => {
  it('normalizes signup source', () => {
    expect(normalizeSignupSource(' IPN ')).toBe('ipn');
    expect(normalizeSignupSource('')).toBeNull();
    expect(normalizeSignupSource('bad code!')).toBeNull();
  });

  it('resolves known promo by ref', () => {
    const promo = getSignupPromo('ipn');
    expect(promo?.trialMessages).toBe(500);
    expect(promo?.trialCreditGbp).toBe(25);
    expect(promo?.defaultTemplateId).toBe('property-manager');
  });

  it('returns null for unknown ref', () => {
    expect(getSignupPromo('google')).toBeNull();
  });

  it('lists configured promo codes', () => {
    expect(listSignupPromoCodes()).toContain('ipn');
  });
});
