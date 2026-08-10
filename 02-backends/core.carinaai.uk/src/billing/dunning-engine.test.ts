import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type Stripe from 'stripe';

const enterGracePeriodMock = vi.fn(async (_ws: string, endsAt?: Date) => ({
  graceEndsAt: (endsAt ?? new Date(Date.now() + 14 * 86_400_000)).toISOString(),
}));
const isInGracePeriodMock = vi.fn(async () => true);
const exitGracePeriodMock = vi.fn(async () => undefined);

vi.mock('./grace-period.js', () => ({
  enterGracePeriod: (...args: unknown[]) => enterGracePeriodMock(...(args as [string, Date?])),
  isInGracePeriod: (...args: unknown[]) => isInGracePeriodMock(...(args as [])),
  exitGracePeriod: (...args: unknown[]) => exitGracePeriodMock(...(args as [string, 'recovered' | 'cancelled'])),
}));

vi.mock('./aiva-stripe-metadata.js', () => ({
  resolveWorkspaceIdFromInvoice: async (invoice: Stripe.Invoice) =>
    String(invoice.metadata?.workspaceId ?? ''),
  subscriptionIdFromInvoice: (invoice: Stripe.Invoice) =>
    typeof invoice.subscription === 'string' ? invoice.subscription : null,
}));

vi.mock('../email/workspace-contact.js', () => ({
  aivaAppUrl: (p: string) => `https://admin.hireaiva.co.uk${p}`,
}));

const PREV_HOME = process.env.CARINA_HOME;

describe('dunning engine', () => {
  let tmpHome: string;

  beforeEach(async () => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-dunning-'));
    process.env.CARINA_HOME = tmpHome;
    enterGracePeriodMock.mockClear();
    isInGracePeriodMock.mockClear();
    exitGracePeriodMock.mockClear();
    isInGracePeriodMock.mockResolvedValue(true);

    const { resetDunningStoreCache } = await import('./dunning-store.js');
    const { setDunningEmailSender } = await import('./dunning-emails.js');
    resetDunningStoreCache();
    setDunningEmailSender(async () => undefined);
  });

  afterEach(async () => {
    const { resetDunningStoreCache } = await import('./dunning-store.js');
    const { setDunningEmailSender } = await import('./dunning-emails.js');
    resetDunningStoreCache();
    setDunningEmailSender(null);
    if (PREV_HOME === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = PREV_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('schedules retries on days 1,3,5,7,14 and emails on 1,5,12', async () => {
    const { scheduleRetries } = await import('./dunning-engine.js');
    const { DUNNING_EMAIL_DAYS, DUNNING_RETRY_DAYS } = await import('./dunning-store.js');
    const failedAt = '2026-05-01T00:00:00.000Z';
    const retries = scheduleRetries(failedAt);
    expect(retries.map((r) => r.dayOffset)).toEqual([...DUNNING_RETRY_DAYS]);
    expect([...DUNNING_EMAIL_DAYS]).toEqual([1, 5, 12]);
  });

  it('enters grace on first failure, sends stage-1 email, keeps access during grace', async () => {
    const { handleFailedInvoice, processDueDunning, processSuccessfulRetry } = await import(
      './dunning-engine.js'
    );
    const { buildDunningEmail } = await import('./dunning-emails.js');
    const { getDunningStats } = await import('./dunning-stats.js');

    const stage1 = buildDunningEmail(1, {
      amount: '£49.00',
      graceEndsLabel: 'Friday',
      portalUrl: 'https://billing.stripe.com/p/session/test',
    });
    expect(stage1.body).toMatch(/update/i);
    expect(stage1.body).toContain('https://billing.stripe.com/p/session/test');

    const sent: number[] = [];
    const { setDunningEmailSender } = await import('./dunning-emails.js');
    setDunningEmailSender(async ({ stage }) => {
      sent.push(stage);
    });

    const first = await handleFailedInvoice({
      id: 'in_1',
      metadata: { workspaceId: 'ws-dun-1' },
      amount_due: 4900,
      currency: 'gbp',
      customer: 'cus_1',
      subscription: 'sub_1',
    } as Stripe.Invoice);

    expect(first?.status).toBe('active');
    expect(enterGracePeriodMock).toHaveBeenCalled();
    expect(sent).toContain(1);
    expect(first?.retries).toHaveLength(5);
    expect(first?.emails).toHaveLength(3);

    // Second Stripe failure during grace must not cancel
    isInGracePeriodMock.mockResolvedValue(true);
    const second = await handleFailedInvoice({
      id: 'in_2',
      metadata: { workspaceId: 'ws-dun-1' },
      amount_due: 4900,
      currency: 'gbp',
    } as Stripe.Invoice);
    expect(second?.status).toBe('active');
    expect(exitGracePeriodMock).not.toHaveBeenCalledWith('ws-dun-1', 'cancelled');

    // Advance to day 5 email
    const day5 = new Date(Date.parse(first!.failedAt) + 5 * 86_400_000 + 60_000);
    await processDueDunning(day5);
    expect(sent).toContain(2);

    const recovered = await processSuccessfulRetry('ws-dun-1');
    expect(recovered?.status).toBe('recovered');
    expect(exitGracePeriodMock).toHaveBeenCalledWith('ws-dun-1', 'recovered');

    const stats = getDunningStats();
    expect(stats.recoveredPayments).toBe(1);
    expect(stats.recoveryRatePct).toBeGreaterThanOrEqual(30);
  });

  it('cancels after grace ends (final failure)', async () => {
    const { handleFailedInvoice, processDueDunning } = await import('./dunning-engine.js');
    const { setDunningEmailSender } = await import('./dunning-emails.js');
    setDunningEmailSender(async () => undefined);

    const created = await handleFailedInvoice({
      id: 'in_final',
      metadata: { workspaceId: 'ws-final' },
      amount_due: 1900,
      currency: 'gbp',
    } as Stripe.Invoice);
    expect(created).toBeTruthy();

    const afterGrace = new Date(Date.parse(created!.graceEndsAt) + 60_000);
    isInGracePeriodMock.mockResolvedValue(false);
    const result = await processDueDunning(afterGrace);
    expect(result.finals).toBeGreaterThanOrEqual(1);
    expect(exitGracePeriodMock).toHaveBeenCalledWith('ws-final', 'cancelled');
  });
});
