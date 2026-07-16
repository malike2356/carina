import { describe, expect, it, beforeEach } from 'vitest';
import {
  invalidateBillingConfigCache,
  resolveConfigValue,
  upsertBillingConfig,
} from '../billing-config.js';

describe('billing-config', () => {
  beforeEach(() => {
    invalidateBillingConfigCache();
  });

  it('resolveConfigValue falls back to env when cache is empty', () => {
    process.env.STRIPE_PRICE_SCOUT_MONITOR = 'price_env_monitor';
    expect(resolveConfigValue('STRIPE_PRICE_SCOUT_MONITOR')).toBe('price_env_monitor');
  });

  it('upsertBillingConfig rejects unknown keys', async () => {
    await expect(upsertBillingConfig('STRIPE_PRICE_UNKNOWN', 'price_x', 'tester')).rejects.toThrow(
      'Unknown billing config key',
    );
  });
});
