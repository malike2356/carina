import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./billing-config.js', () => ({
  resolveConfigValue: vi.fn((key: string) => {
    const map: Record<string, string> = {
      AIVA_SOFT_WALL_ALLOW_BYOK: 'on',
      AIVA_SOFT_WALL_ALLOW_TOPUP: 'off',
      AIVA_SOFT_WALL_ALLOW_UPGRADE: 'on',
      AIVA_SOFT_WALL_ALLOW_MINI_LLM: 'on',
      AIVA_TRIAL_MESSAGE_LIMIT: '20',
      AIVA_TRIAL_CREDIT_GBP: '1',
      AIVA_TRIAL_DAILY_CAP_GBP: '2',
      CARINA_CLOUD_FREE_DAILY_MESSAGES: '25',
      CARINA_CLOUD_FREE_DAILY_TOKENS: '40000',
    };
    return map[key] ?? '';
  }),
}));

describe('usage-gate-policy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters soft-wall actions from operator toggles', async () => {
    const { resolveSoftWallActions, describeUsageGatePolicy } = await import('./usage-gate-policy.js');
    expect(resolveSoftWallActions(['byok', 'topup', 'upgrade', 'mini_llm'])).toEqual([
      'byok',
      'upgrade',
      'mini_llm',
    ]);
    expect(describeUsageGatePolicy()).toMatchObject({
      aivaTrialMessages: 20,
      carinaFreeDailyMessages: 25,
      carinaFreeDailyTokens: 40000,
      softWallActions: ['byok', 'upgrade', 'mini_llm'],
    });
  });
});
