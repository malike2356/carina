import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const grantAivaTrialCredit = vi.fn(async () => ({ granted: true, pence: 100 }));

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('../billing/aiva-billing.js', () => ({ suspendIfGraceExpired: vi.fn() }));
vi.mock('../billing/plan-tier.js', () => ({ effectivePlanTier: (tier: string) => tier }));
vi.mock('../billing/aiva-ai-wallet.js', () => ({ grantAivaTrialCredit }));
vi.mock('../usage/usage-service.js', () => ({
  getUsageBar: vi.fn(),
  getCurrentUsage: vi.fn(),
  messageLimit: vi.fn(() => 1000),
  resolveTrialCreditGbp: vi.fn(() => 1),
}));
vi.mock('./worker-store.js', () => ({ listWorkers: vi.fn(async () => []) }));

describe('provisionTrial wallet credit', () => {
  beforeEach(() => {
    query.mockReset();
    grantAivaTrialCredit.mockClear();
  });

  it('grants £1 trial credit when creating a new subscription', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // getSubscription
      .mockResolvedValueOnce({
        rows: [{
          workspace_id: 'ws-new',
          plan_tier: 'trial',
          status: 'pending_channel',
          trial_ends_at: null,
          aiva_slot_limit: 1,
        }],
      });

    const { provisionTrial } = await import('./aiva-subscription-store.js');
    await provisionTrial('ws-new');
    expect(grantAivaTrialCredit).toHaveBeenCalledWith('ws-new');
  });

  it('still grants trial credit when subscription already exists (idempotent)', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        workspace_id: 'ws-old',
        plan_tier: 'trial',
        status: 'trialing',
        trial_ends_at: new Date('2026-08-28'),
        aiva_slot_limit: 1,
      }],
    });

    const { provisionTrial } = await import('./aiva-subscription-store.js');
    await provisionTrial('ws-old');
    expect(grantAivaTrialCredit).toHaveBeenCalledWith('ws-old');
  });
});
