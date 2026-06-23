import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

describe('margin-report', () => {
  beforeEach(() => {
    query.mockReset();
    delete process.env.CREDIT_USD_RATE;
  });

  it('impliedGrossMargin returns ratio when revenue is positive', async () => {
    const { impliedGrossMargin, MARGIN_FLOOR } = await import('./margin-report.js');
    expect(impliedGrossMargin(100, 30)).toBeCloseTo(0.7);
    expect(MARGIN_FLOOR).toBe(0.65);
  });

  it('impliedGrossMargin returns null when revenue is zero', async () => {
    const { impliedGrossMargin } = await import('./margin-report.js');
    expect(impliedGrossMargin(0, 10)).toBeNull();
  });

  it('flags margin below floor', async () => {
    const { marginBelowFloor } = await import('./margin-report.js');
    expect(marginBelowFloor(0.64)).toBe(true);
    expect(marginBelowFloor(0.65)).toBe(false);
    expect(marginBelowFloor(null)).toBe(false);
  });

  it('getOrgMarginSummary computes revenue from plan credit rate', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'org-1',
        name: 'Acme',
        plan: 'carina_ops_starter',
        credits_billed: '100000',
        provider_cost: '0.50',
      }],
    });
    const { getOrgMarginSummary } = await import('./margin-report.js');
    const summary = await getOrgMarginSummary('org-1');
    expect(summary).not.toBeNull();
    expect(summary!.creditsBilled).toBe(100_000);
    expect(summary!.creditRevenueUsd).toBeGreaterThan(0);
    expect(summary!.grossMargin).not.toBeNull();
  });

  it('getPlatformMarginSummary aggregates org rows', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          id: 'org-1',
          name: 'Acme',
          plan: 'carina_ops_starter',
          credits_billed: '50000',
          provider_cost: '1.00',
        },
        {
          id: 'org-2',
          name: 'Beta',
          plan: 'carina_ops_team',
          credits_billed: '0',
          provider_cost: '2.50',
        },
      ],
    });
    const { getPlatformMarginSummary } = await import('./margin-report.js');
    const platform = await getPlatformMarginSummary();
    expect(platform.orgs).toHaveLength(2);
    expect(platform.orgs[1].byokCostOnly).toBe(true);
    expect(platform.totals.providerCostUsd).toBeCloseTo(3.5);
  });
});

describe('resolveCreditUsdRate', () => {
  it('uses env override when set', async () => {
    process.env.CREDIT_USD_RATE = '0.00005';
    const { resolveCreditUsdRate } = await import('./plans.js');
    expect(resolveCreditUsdRate('carina_ops_starter')).toBe(0.00005);
  });

  it('derives rate from plan price and included credits', async () => {
    delete process.env.CREDIT_USD_RATE;
    const { resolveCreditUsdRate, DEFAULT_CREDIT_GBP_USD } = await import('./plans.js');
    const rate = resolveCreditUsdRate('carina_ops_starter');
    expect(rate).toBeCloseTo((19 * DEFAULT_CREDIT_GBP_USD) / 500_000);
  });
});
