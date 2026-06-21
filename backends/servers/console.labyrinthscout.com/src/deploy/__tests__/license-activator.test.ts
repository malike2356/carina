import { describe, expect, it } from 'vitest';
import { validateLicenseKey } from '../license-activator.js';

describe('license activator', () => {
  it('validates Scout licence key structure', () => {
    expect(validateLicenseKey('scout_live_abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(validateLicenseKey('not-a-key')).toBe(false);
  });
});
