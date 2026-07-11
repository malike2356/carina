import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchBillingUsage } from './billing-client';

describe('billing-client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns usage payload from Carina Cloud', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          usage: { tokensUsed: 1200, limit: 50000 },
          subscription: { plan: 'free', status: 'active', current_period_start: null, current_period_end: null },
          tier: 'free',
          planName: 'Free',
          tokenLimit: 50000,
          monthlyPriceGbp: null,
          messagesToday: 3,
          freeDailyLimit: 100,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const data = await fetchBillingUsage('https://app.carinaai.uk');
    expect(data.usage.tokensUsed).toBe(1200);
    expect(data.planName).toBe('Free');
  });

  it('throws a readable error when billing is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Billing not configured', { status: 503, statusText: 'Service Unavailable' }),
    );

    await expect(fetchBillingUsage('https://app.carinaai.uk')).rejects.toThrow(
      'Billing usage 503',
    );
  });
});
