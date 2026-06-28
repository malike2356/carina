import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const getSubscription = vi.fn();
const sendUsageWarningEmail = vi.fn();
const sendUsageLimitReachedEmail = vi.fn();
const firstWorkerName = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('../workers/aiva-subscription-store.js', () => ({ getSubscription }));
vi.mock('../email/email-triggers.js', () => ({
  sendUsageWarningEmail,
  sendUsageLimitReachedEmail,
  firstWorkerName,
}));

describe('usage-service', () => {
  beforeEach(() => {
    query.mockReset();
    getSubscription.mockReset();
    sendUsageWarningEmail.mockResolvedValue(undefined);
    sendUsageLimitReachedEmail.mockResolvedValue(undefined);
    firstWorkerName.mockReset();
    getSubscription.mockResolvedValue({ planTier: 'starter' });
    firstWorkerName.mockResolvedValue('Aria');
  });

  it('defines tier message limits including unlimited business', async () => {
    const { MESSAGE_LIMITS_BY_TIER, messageLimit } = await import('./usage-service.js');
    expect(MESSAGE_LIMITS_BY_TIER).toMatchObject({
      trial: 200,
      starter: 2000,
      team: 10000,
    });
    expect(messageLimit('business')).toBe(Number.POSITIVE_INFINITY);
    expect(messageLimit('unknown')).toBe(200);
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
  });

  it('allows business tier regardless of usage', async () => {
    getSubscription.mockResolvedValue({ planTier: 'business' });
    query.mockResolvedValueOnce({
      rows: [{ message_count: 50000, warning_sent_at: null, limit_reached_at: null }],
    });

    const { checkAndEnforceLimit } = await import('./usage-service.js');
    const result = await checkAndEnforceLimit('ws-1');
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
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
