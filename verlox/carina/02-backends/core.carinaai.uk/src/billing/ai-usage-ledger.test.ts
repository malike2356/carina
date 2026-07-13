import { describe, expect, it } from 'vitest';
import { calculateUsageCost } from './ai-usage-ledger.js';

describe('ai usage ledger cost formula', () => {
  it('allocates provider cost, payment overhead, and platform margin', () => {
    const cost = calculateUsageCost({
      model: 'gpt-4o',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });

    expect(cost.providerCostMinor).toBe(1000);
    expect(cost.paymentOverheadMinor).toBe(35);
    expect(cost.platformMarginMinor).toBe(15);
    expect(cost.internalChargeBasisMinor).toBe(1050);
  });

  it('separates BYOK from Carina-paid provider cost', () => {
    const cost = calculateUsageCost({
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      byok: true,
    });

    expect(cost.providerCostMinor).toBe(0);
    expect(cost.paymentOverheadMinor).toBe(0);
    expect(cost.platformMarginMinor).toBe(0);
    expect(cost.internalChargeBasisMinor).toBe(0);
  });
});
