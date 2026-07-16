import { describe, expect, it } from 'vitest';
import {
  buildPromoRegisterPath,
  buildPromoRegisterUrl,
  getSignupPromo,
  normalizeSignupRef,
  promoFromSearchParams,
} from './aiva-signup-promo';

describe('aiva-signup-promo', () => {
  it('normalizes refs', () => {
    expect(normalizeSignupRef(' IPN ')).toBe('ipn');
    expect(normalizeSignupRef('bad!')).toBeNull();
  });

  it('resolves known promo without partner branding helpers', () => {
    const promo = getSignupPromo('ipn');
    expect(promo?.trialMessages).toBe(500);
    expect(promo?.defaultTemplateId).toBe('property-manager');
  });

  it('builds register path from promo code', () => {
    expect(buildPromoRegisterPath('ipn')).toContain('ref=ipn');
    expect(buildPromoRegisterPath('ipn')).toContain('template=property-manager');
  });

  it('builds absolute Aiva-host register URL', () => {
    expect(buildPromoRegisterUrl('ipn')).toMatch(/^https:\/\/admin\.hireaiva\.co\.uk\/register\?/);
    expect(buildPromoRegisterUrl('ipn')).toContain('ref=ipn');
  });

  it('parses search params', () => {
    const params = new URLSearchParams('ref=ipn');
    expect(promoFromSearchParams(params)?.code).toBe('ipn');
  });
});
