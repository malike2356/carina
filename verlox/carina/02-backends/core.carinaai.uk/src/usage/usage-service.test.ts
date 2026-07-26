import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const getSubscription = vi.fn();
const sendUsageWarningEmail = vi.fn();
const sendUsageLimitReachedEmail = vi.fn();
const firstWorkerName = vi.fn();
const checkAivaWalletGate = vi.fn();
const getAivaWalletBalance = vi.fn();
const getAivaPrepaidBalance = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('../workers/aiva-subscription-store.js', () => ({ getSubscription }));
vi.mock('../email/email-triggers.js', () => ({
  sendUsageWarningEmail,
  sendUsageLimitReachedEmail,
  firstWorkerName,
}));
vi.mock('../billing/billing-config.js', () => ({
  resolveConfigValue: (key: string) => {
    if (key === 'AIVA_TRIAL_MESSAGE_LIMIT') return '';
    if (key === 'AIVA_TRIAL_CREDIT_GBP') return '';
    return '';
  },
}));
vi.mock('../billing/aiva-prepaid-store.js', () => ({
  getAivaPrepaidBalance,
  debitAivaPrepaidMessage: vi.fn(async () => false),
  ensureAivaPrepaidSchema: vi.fn(async () => undefined),
}));
vi.mock('../billing/aiva-ai-wallet.js', () => ({
  checkAivaWalletGate,
  getAivaWalletBalance,
  debitAivaWalletUsage: vi.fn(async () => ({ debitedPence: 1 })),
  recordAivaByokUsage: vi.fn(async () => undefined),
}));

describe('usage-service', () => {
  beforeEach(() => {
    query.mockReset();
    getSubscription.mockReset();
    sendUsageWarningEmail.mockResolvedValue(undefined);
    sendUsageLimitReachedEmail.mockResolvedValue(undefined);
    firstWorkerName.mockReset();
    getSubscription.mockResolvedValue({ planTier: 'starter', status: 'active' });
    firstWorkerName.mockResolvedValue('Aria');
    getAivaPrepaidBalance.mockResolvedValue({ remainingMessages: 0, remainingGbp: 0 });
    getAivaWalletBalance.mockResolvedValue({
      remainingPence: 0,
      remainingGbp: 0,
      trialGrantedPence: 0,
      purchasedPence: 0,
      debitedPence: 0,
      lowCredit: false,
      exhausted: true,
    });
    checkAivaWalletGate.mockResolvedValue({
      allowed: true,
      mode: 'managed',
      remainingPence: 0,
      dailySpentPence: 0,
      dailyCapPence: null,
    });
  });

  it('defines tier message limits including unlimited business', async () => {
    const { MESSAGE_LIMITS_BY_TIER, messageLimit, resolveTrialMessageLimit, resolveTrialCreditGbp } =
      await import('./usage-service.js');
    expect(MESSAGE_LIMITS_BY_TIER).toMatchObject({
      trial: 20,
      starter: 1000,
      team: 10000,
    });
    expect(messageLimit('business')).toBe(Number.POSITIVE_INFINITY);
    expect(messageLimit('unknown')).toBe(20);
    expect(messageLimit('trial')).toBe(20);
    expect(resolveTrialMessageLimit()).toBe(20);
    expect(resolveTrialCreditGbp()).toBe(1);
  });

  it('blocks messages at the monthly cap', async () => {
    query.mockResolvedValueOnce({
      rows: [{ message_count: 2000, warning_sent_at: null, limit_reached_at: null }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const { checkAndEnforceLimit } = await import('./usage-service.js');
    const result = await checkAndEnforceLimit('ws-1');
    expect(result.allowed).toBe(false);
    expect(result.limit).toBe(2000);
    expect(result.actions).toContain('byok');
  });

  it('allows business tier regardless of usage', async () => {
    getSubscription.mockResolvedValue({ planTier: 'business', status: 'active' });
    query.mockResolvedValueOnce({
      rows: [{ message_count: 50000, warning_sent_at: null, limit_reached_at: null }],
    });

    const { checkAndEnforceLimit } = await import('./usage-service.js');
    const result = await checkAndEnforceLimit('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns BYOK actions when trial credit is exhausted', async () => {
    getSubscription.mockResolvedValue({ planTier: 'trial', status: 'trialing' });
    checkAivaWalletGate.mockResolvedValue({
      allowed: false,
      mode: 'denied',
      reason: 'managed AI credit exhausted',
      remainingPence: 0,
      dailySpentPence: 0,
      dailyCapPence: 200,
      actions: ['byok', 'topup', 'upgrade'],
    });
    query.mockResolvedValueOnce({
      rows: [{ message_count: 5, warning_sent_at: null, limit_reached_at: null }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const { checkAndEnforceLimit } = await import('./usage-service.js');
    const result = await checkAndEnforceLimit('ws-1');
    expect(result.allowed).toBe(false);
    expect(result.actions).toEqual(['byok', 'topup', 'upgrade']);
  });

  it('ignores spoofed plan hints and uses subscription workspace only', async () => {
    getSubscription.mockResolvedValue({ planTier: 'trial', status: 'trialing' });
    checkAivaWalletGate.mockResolvedValue({
      allowed: false,
      mode: 'denied',
      remainingPence: 0,
      dailySpentPence: 0,
      dailyCapPence: 200,
      actions: ['byok', 'topup', 'upgrade'],
    });
    query.mockResolvedValue({
      rows: [{ message_count: 0, warning_sent_at: null, limit_reached_at: null }],
    });

    const { checkAndEnforceLimit } = await import('./usage-service.js');
    const result = await checkAndEnforceLimit('ws-1');
    expect(getSubscription).toHaveBeenCalledWith('ws-1');
    expect(result.planTier).toBe('trial');
    expect(result.allowed).toBe(false);
  });

  it('sends warning email once at 80 percent usage', async () => {
    query.mockResolvedValueOnce({
      rows: [{ message_count: 1600, warning_sent_at: null, limit_reached_at: null }],
    });
    query.mockResolvedValueOnce({ rows: [] });

    const { maybeSendUsageAlerts } = await import('./usage-service.js');
    await maybeSendUsageAlerts('ws-1');

    expect(sendUsageWarningEmail).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'ws-1',
      messageCount: 1600,
      messageLimit: 2000,
      usagePercent: 80,
    }));
  });
});
