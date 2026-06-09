import { describe, expect, it } from 'vitest';
import { normalizeTrustSettings } from '../trust-settings.js';

describe('normalizeTrustSettings', () => {
  it('defaults to standard weekly intervals', () => {
    expect(normalizeTrustSettings(null)).toEqual({
      tier: 'standard',
      attestation_interval_days: 7,
      verification_interval_days: 7,
    });
  });

  it('allows enterprise daily intervals', () => {
    expect(normalizeTrustSettings({
      tier: 'enterprise',
      attestation_interval_days: 1,
      verification_interval_days: 1,
    })).toEqual({
      tier: 'enterprise',
      attestation_interval_days: 1,
      verification_interval_days: 1,
    });
  });
});
