import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

describe('reconciliation-job helpers', () => {
  it('computeDriftPercent uses the larger side as baseline', async () => {
    const { computeDriftPercent } = await import('./reconciliation-job.js');
    expect(computeDriftPercent(10, 10.6)).toBeCloseTo(5.66, 1);
    expect(computeDriftPercent(0, 0)).toBe(0);
  });

  it('buildReconciliationRows flags drift above threshold', async () => {
    const { buildReconciliationRows, DRIFT_THRESHOLD_PERCENT } = await import('./reconciliation-job.js');
    const rows = buildReconciliationRows({
      ledgerByOrg: new Map([
        ['org-a', 1],
        ['org-b', 10],
      ]),
      usageByOrg: new Map([
        ['org-a', 1.2],
        ['org-b', 10],
      ]),
    });
    expect(DRIFT_THRESHOLD_PERCENT).toBe(5);
    expect(rows).toHaveLength(1);
    expect(rows[0].orgId).toBe('org-a');
    expect(rows[0].driftPercent).toBeGreaterThan(5);
  });

  it('logReconciliationReport warns for drift rows', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { logReconciliationReport } = await import('./reconciliation-job.js');
    logReconciliationReport({
      month: '2026-06',
      driftThresholdPercent: 5,
      rows: [{
        orgId: 'org-a',
        ledgerProviderCostUsd: 1,
        modelUsageCostUsd: 2,
        driftPercent: 50,
      }],
    });
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe('reconcileLedgerVsModelUsage', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('returns empty rows when ledger and usage align', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ org_id: 'org-1', total: '1.0000' }],
      })
      .mockResolvedValueOnce({
        rows: [{ org_id: 'org-1', total: '1.0100' }],
      });
    const { reconcileLedgerVsModelUsage } = await import('./reconciliation-job.js');
    const report = await reconcileLedgerVsModelUsage();
    expect(report.rows).toHaveLength(0);
    expect(report.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns drift rows when costs diverge', async () => {
    query
      .mockResolvedValueOnce({
        rows: [{ org_id: 'org-1', total: '10.0000' }],
      })
      .mockResolvedValueOnce({
        rows: [{ org_id: 'org-1', total: '1.0000' }],
      });
    const { reconcileLedgerVsModelUsage } = await import('./reconciliation-job.js');
    const report = await reconcileLedgerVsModelUsage('org-1');
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      orgId: 'org-1',
      ledgerProviderCostUsd: 10,
      modelUsageCostUsd: 1,
    });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0][1]).toEqual(['org-1']);
    expect(query.mock.calls[1][1]).toEqual(['org-1']);
  });
});

describe('runBillingReconciliation', () => {
  beforeEach(() => {
    query.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('logs and returns the reconciliation report', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const { runBillingReconciliation } = await import('./reconciliation-job.js');
    const report = await runBillingReconciliation();
    expect(report.rows).toEqual([]);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[reconciliation]'));
  });
});

describe('reconciliation scheduler', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    delete process.env.CARINA_OPS_RECONCILIATION_ENABLED;
    process.env.CARINA_OPS_PRODUCT_ENABLED = 'true';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not start when disabled', async () => {
    const reconcile = vi.fn(async () => ({ month: '2026-06', driftThresholdPercent: 5, rows: [] }));
    vi.doMock('./reconciliation-job.js', () => ({
      runBillingReconciliation: reconcile,
    }));
    vi.doMock('../config/index.js', () => ({
      config: { carinaOps: { productEnabled: true } },
    }));
    const { startBillingReconciliationSchedule } = await import('./reconciliation-scheduler.js');
    startBillingReconciliationSchedule();
    await vi.runOnlyPendingTimersAsync();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('runs immediately and on interval when enabled', async () => {
    process.env.CARINA_OPS_RECONCILIATION_ENABLED = 'true';
    process.env.CARINA_OPS_RECONCILIATION_INTERVAL_HOURS = '12';
    const reconcile = vi.fn(async () => ({ month: '2026-06', driftThresholdPercent: 5, rows: [] }));
    vi.doMock('./reconciliation-job.js', () => ({
      runBillingReconciliation: reconcile,
    }));
    vi.doMock('../config/index.js', () => ({
      config: { carinaOps: { productEnabled: true } },
    }));
    const { startBillingReconciliationSchedule, stopBillingReconciliationSchedule } =
      await import('./reconciliation-scheduler.js');
    startBillingReconciliationSchedule();
    await Promise.resolve();
    await Promise.resolve();
    const callsAfterStart = reconcile.mock.calls.length;
    expect(callsAfterStart).toBeGreaterThanOrEqual(1);
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000);
    expect(reconcile.mock.calls.length).toBeGreaterThan(callsAfterStart);
    stopBillingReconciliationSchedule();
  });
});
