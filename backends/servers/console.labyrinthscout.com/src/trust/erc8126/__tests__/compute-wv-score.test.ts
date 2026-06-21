import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({
      rows: [{
        suspicious_events_30d: '0',
        egress_blocks_30d: '0',
      }],
    }),
  },
}));

import { computeWvRiskScore } from '../compute-wv-score.js';

describe('computeWvRiskScore', () => {
  it('returns high risk for wallets with no history', async () => {
    const publicClient = {
      getTransactionCount: async () => 0,
      getBalance: async () => 0n,
    };

    const result = await computeWvRiskScore({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      publicClient: publicClient as never,
    });

    expect(result.applicable).toBe(true);
    expect(result.risk_score).toBeGreaterThan(40);
  });

  it('returns lower risk for wallets with transaction history', async () => {
    const publicClient = {
      getTransactionCount: async () => 25,
      getBalance: async () => 1_000_000_000_000_000n,
    };

    const result = await computeWvRiskScore({
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      publicClient: publicClient as never,
    });

    expect(result.risk_score).toBeLessThan(30);
  });

  it('marks invalid wallets as not applicable', async () => {
    const result = await computeWvRiskScore({ walletAddress: 'not-a-wallet' });
    expect(result.applicable).toBe(false);
  });
});
