import { describe, expect, it } from 'vitest';
import { mapAivaBillingStatus, resolveSoftWallActions } from './aiva-billing';

describe('aiva billing helpers', () => {
  it('maps wallet, prepaid packs, and limits', () => {
    const status = mapAivaBillingStatus({
      subscription: { planTier: 'trial', status: 'trial_ended' },
      wallet: { remainingPence: 0, exhausted: true },
      agentLimits: { maxCalls: 100, usedCalls: 25, remainingCalls: 75 },
      prepaid: {
        remainingMessages: 20,
        remainingGbp: 2,
        packs: [{ id: 'small', label: 'Small', amountGbp: 5, messages: 50 }],
      },
    });

    expect(status.wallet?.remainingGbp).toBe(0);
    expect(status.agentLimits?.remainingCalls).toBe(75);
    expect(status.packs[0]?.id).toBe('small');
    expect(status.softWall).toBe(false);
  });

  it('offers all recovery actions for an exhausted managed wallet', () => {
    expect(resolveSoftWallActions({
      softWall: true,
      byokActive: false,
      packsAvailable: true,
    })).toEqual(['byok', 'topup', 'upgrade', 'mini_llm']);
  });
});
