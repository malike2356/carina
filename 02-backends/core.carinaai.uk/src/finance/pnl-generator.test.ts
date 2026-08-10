import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resetFinanceStoreCache,
  setCostFetchers,
  setStripeRevenueFetcher,
  generateMonthlyPnL,
  renderMonthlyPnLMarkdown,
  compareMonthOverMonth,
  findLiabilityUsers,
  attributeCostsToUsers,
  sumMinor,
  type CostRow,
} from './index.js';

const PREV_HOME = process.env.CARINA_HOME;

describe('per-user cost tracking and P&L', () => {
  let tmpHome: string;

  beforeEach(() => {
    tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'carina-finance-'));
    process.env.CARINA_HOME = tmpHome;
    resetFinanceStoreCache();
    setCostFetchers({ ai: null, hosting: null, thirdParty: null });
    setStripeRevenueFetcher(null);
  });

  afterEach(() => {
    resetFinanceStoreCache();
    setCostFetchers({ ai: null, hosting: null, thirdParty: null });
    setStripeRevenueFetcher(null);
    if (PREV_HOME === undefined) delete process.env.CARINA_HOME;
    else process.env.CARINA_HOME = PREV_HOME;
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  it('attributes shared costs without losing pennies', () => {
    const direct: CostRow[] = [
      {
        id: '1',
        date: '2026-04-01',
        userId: 'u1',
        service: 'openai',
        amountMinor: 300,
        currency: 'gbp',
        source: 'api',
      },
      {
        id: '2',
        date: '2026-04-01',
        userId: 'u2',
        service: 'openai',
        amountMinor: 100,
        currency: 'gbp',
        source: 'api',
      },
    ];
    const shared: CostRow[] = [
      {
        id: '3',
        date: '2026-04-01',
        userId: '__shared_hosting__',
        service: 'hosting',
        amountMinor: 101,
        currency: 'gbp',
        source: 'manual',
      },
    ];
    const out = attributeCostsToUsers(direct, shared);
    const allocated = out.filter((c) => c.source === 'allocated');
    expect(sumMinor(allocated)).toBe(101);
  });

  it('generates monthly P&L from mock Stripe and AI costs that reconcile', async () => {
    setCostFetchers({
      ai: async () => [
        { date: '2026-04-02', userId: 'user_a', service: 'openai', amountMinor: 2_000, feature: 'chat' },
        { date: '2026-04-03', userId: 'user_b', service: 'anthropic', amountMinor: 8_000, feature: 'chat' },
        { date: '2026-04-04', userId: 'user_c', service: 'openai', amountMinor: 500, feature: 'outreach' },
      ],
      hosting: async () => [
        { date: '2026-04-01', userId: '__shared_hosting__', service: 'hosting', amountMinor: 1_000 },
      ],
      thirdParty: async () => [
        { date: '2026-04-01', userId: '__shared_saas__', service: 'third_party', amountMinor: 200 },
      ],
    });
    setStripeRevenueFetcher(async () => [
      {
        date: '2026-04-01',
        userId: 'user_a',
        kind: 'subscription',
        amountMinor: 4_900,
        stripeChargeId: 'ch_a',
      },
      {
        date: '2026-04-01',
        userId: 'user_b',
        kind: 'subscription',
        amountMinor: 4_900,
        stripeChargeId: 'ch_b',
      },
      {
        date: '2026-04-05',
        userId: 'user_c',
        kind: 'subscription',
        amountMinor: 1_900,
        stripeChargeId: 'ch_c',
      },
      {
        date: '2026-04-10',
        userId: 'user_a',
        kind: 'refund',
        amountMinor: -100,
        stripeChargeId: 're_a',
      },
    ]);

    const pnl = await generateMonthlyPnL(2026, 4, { refresh: true });
    expect(pnl.checksum.reconciles).toBe(true);
    expect(pnl.revenue.totalMinor).toBe(4_900 + 4_900 + 1_900 - 100);
    expect(pnl.cogs.totalMinor).toBe(2_000 + 8_000 + 500 + 1_000 + 200);
    expect(pnl.grossMarginMinor).toBe(pnl.revenue.totalMinor - pnl.cogs.totalMinor);
    expect(pnl.perFeature.length).toBeGreaterThan(0);

    const liabilities = findLiabilityUsers(1.0, 2026, 4);
    expect(liabilities.some((u) => u.userId === 'user_b')).toBe(true);

    const again = await generateMonthlyPnL(2026, 4, { refresh: false });
    expect(again.revenue.totalMinor).toBe(pnl.revenue.totalMinor);
    expect(again.cogs.totalMinor).toBe(pnl.cogs.totalMinor);

    const md = renderMonthlyPnLMarkdown(pnl);
    expect(md).toContain('# P&L 2026-04');
    expect(md).toContain('Liability');

    const prev = await generateMonthlyPnL(2026, 3, { refresh: true });
    const mom = compareMonthOverMonth(pnl, prev);
    expect(typeof mom.revenueDeltaMinor).toBe('number');
  });
});
