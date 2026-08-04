import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  fetchAivaBillingStatus,
  mapAivaBillingStatus,
  resolveSoftWallActions,
} from './aiva-billing';

describe('mapAivaBillingStatus', () => {
  it('maps plan, wallet, and agentLimits', () => {
    const view = mapAivaBillingStatus({
      planTier: 'starter',
      subscription: {
        planTier: 'starter',
        status: 'active',
        trialEndsAt: null,
        trialDaysRemaining: null,
      },
      usage: { messageCount: 12, messageLimit: 500, usagePercent: 2 },
      wallet: {
        remainingPence: 450,
        remainingGbp: 4.5,
        trialGrantedPence: 100,
        purchasedPence: 500,
        debitedPence: 150,
        lowCredit: false,
        exhausted: false,
      },
      agentLimits: {
        period: 'day',
        maxCalls: 40,
        maxTokens: 80000,
        usedCalls: 5,
        usedTokens: 1000,
        remainingCalls: 35,
        remainingTokens: 79000,
        custom: false,
      },
      prepaid: { remainingMessages: 0, remainingGbp: 0, packs: [] },
    });

    expect(view.planTier).toBe('starter');
    expect(view.status).toBe('active');
    expect(view.wallet?.remainingGbp).toBe(4.5);
    expect(view.agentLimits?.remainingCalls).toBe(35);
    expect(view.softWall).toBe(false);
    expect(view.softWallActions).toEqual([]);
  });

  it('opens soft wall on trial_ended and exposes byok/topup/upgrade', () => {
    const view = mapAivaBillingStatus({
      subscription: { planTier: 'trial', status: 'trial_ended', softWall: true },
      wallet: { remainingPence: 0, remainingGbp: 0, exhausted: true },
      prepaid: {
        remainingMessages: 0,
        packs: [{ id: 'gbp5', label: '£5', amountGbp: 5, messages: 100 }],
      },
    });
    expect(view.softWall).toBe(true);
    expect(view.softWallActions).toEqual(['byok', 'topup', 'upgrade']);
  });

  it('gracefully handles missing wallet and agentLimits', () => {
    const view = mapAivaBillingStatus({
      subscription: { planTier: 'growth', status: 'active' },
      usage: { messageCount: 1 },
    });
    expect(view.wallet).toBeNull();
    expect(view.agentLimits).toBeNull();
    expect(view.softWall).toBe(false);
    expect(view.messageCount).toBe(1);
    expect(view.messageLimit).toBeNull();
  });

  it('clears soft wall when BYOK is active', () => {
    const view = mapAivaBillingStatus({
      subscription: {
        planTier: 'trial',
        status: 'trial_ended',
        byokActive: true,
        softWall: false,
      },
      wallet: { exhausted: true, remainingPence: 0 },
      prepaid: { remainingMessages: 0, packs: [] },
    });
    expect(view.wallet?.byokActive).toBe(true);
    expect(view.softWall).toBe(false);
    expect(view.softWallActions).toEqual([]);
  });
});

describe('resolveSoftWallActions', () => {
  it('builds visibility matrix for byok vs topup vs upgrade', () => {
    expect(
      resolveSoftWallActions({ softWall: false, byokActive: false, packsAvailable: true }),
    ).toEqual([]);
    expect(
      resolveSoftWallActions({ softWall: true, byokActive: false, packsAvailable: false }),
    ).toEqual(['byok', 'upgrade']);
    expect(
      resolveSoftWallActions({ softWall: true, byokActive: false, packsAvailable: true }),
    ).toEqual(['byok', 'topup', 'upgrade']);
  });
});

describe('fetchAivaBillingStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Aiva billing status with auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          subscription: { planTier: 'team', status: 'active' },
          wallet: { remainingGbp: 2, remainingPence: 200 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const view = await fetchAivaBillingStatus('https://app.carinaai.uk/', { apiKey: 'sess' });
    expect(view.planTier).toBe('team');
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://app.carinaai.uk/api/aiva/billing/status',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer sess' }),
      }),
    );
  });
});
