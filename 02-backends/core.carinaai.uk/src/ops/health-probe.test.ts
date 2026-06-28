import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const poolQuery = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query: poolQuery } }));

describe('health-probe', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    poolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const { clearStatusCacheForTesting } = await import('./health-probe.js');
    clearStatusCacheForTesting();
  });

  afterEach(async () => {
    const { clearStatusCacheForTesting } = await import('./health-probe.js');
    clearStatusCacheForTesting();
  });

  describe('runHealthProbe', () => {
    it('inserts a row for each probe target on success', async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 }) as unknown as typeof fetch;

      const { runHealthProbe } = await import('./health-probe.js');
      await runHealthProbe();

      const insertCalls = poolQuery.mock.calls.filter(
        (c) => (c[0] as string).includes('INSERT INTO platform_health_checks'),
      );
      expect(insertCalls).toHaveLength(3); // platform_api, core_api, app_frontend
      const params = insertCalls[0][1] as unknown[];
      expect(params[3]).toBe(true); // healthy
    });

    it('records healthy=false and error message on fetch failure', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch;

      const { runHealthProbe } = await import('./health-probe.js');
      await runHealthProbe();

      const insertCalls = poolQuery.mock.calls.filter(
        (c) => (c[0] as string).includes('INSERT INTO platform_health_checks'),
      );
      expect(insertCalls).toHaveLength(3);
      const params = insertCalls[0][1] as unknown[];
      expect(params[3]).toBe(false); // healthy = false
      expect(params[4]).toContain('connection refused');
    });
  });

  describe('calculateSlaReport', () => {
    it('returns slaBreach=false when checks are healthy', async () => {
      // 1 unhealthy out of 1440 = 99.93%, above 99.9% threshold
      poolQuery
        .mockResolvedValueOnce({ rows: [{ total_checks: '1440', unhealthy_checks: '1' }] })
        .mockResolvedValue({ rows: [] });

      const { calculateSlaReport } = await import('./health-probe.js');
      const report = await calculateSlaReport('2026-06');

      expect(report.slaBreach).toBe(false);
      expect(report.uptimePercent).toBeCloseTo(99.93, 1);
      expect(report.creditDuePartners).toHaveLength(0);
    });

    it('returns slaBreach=true and creditDuePartners when uptime falls below 99.9%', async () => {
      // 600 unhealthy out of 43200 = 98.6% uptime
      poolQuery
        .mockResolvedValueOnce({ rows: [{ total_checks: '43200', unhealthy_checks: '600' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'partner-1', name: 'Acme Corp' }] });

      const { calculateSlaReport } = await import('./health-probe.js');
      const report = await calculateSlaReport('2026-06');

      expect(report.slaBreach).toBe(true);
      expect(report.creditDuePartners.length).toBeGreaterThan(0);
      expect(report.creditDuePartners[0].partnerName).toBe('Acme Corp');
      expect(report.creditDuePartners[0].creditPence).toBeGreaterThan(0);
    });

    it('returns uptimePercent=100 when no checks have been run', async () => {
      poolQuery.mockResolvedValueOnce({ rows: [{ total_checks: '0', unhealthy_checks: '0' }] });

      const { calculateSlaReport } = await import('./health-probe.js');
      const report = await calculateSlaReport('2026-06');

      expect(report.uptimePercent).toBe(100);
      expect(report.slaBreach).toBe(false);
    });
  });

  describe('getPlatformStatus', () => {
    it('returns operational for all services when checks are healthy', async () => {
      poolQuery.mockResolvedValueOnce({
        rows: [
          { endpoint: 'platform_api', total: '1000', healthy_count: '1000' },
          { endpoint: 'core_api',     total: '1000', healthy_count: '999' },
          { endpoint: 'app_frontend', total: '1000', healthy_count: '998' },
        ],
      });

      const { getPlatformStatus } = await import('./health-probe.js');
      // bypass cache by clearing module
      const status = await getPlatformStatus();

      expect(status.sla).toBe('99.9%');
      const platformApi = status.services.find((s) => s.name === 'Platform API');
      expect(platformApi?.status).toBe('operational');
    });

    it('marks service as degraded when uptime falls between 95% and 99.5%', async () => {
      poolQuery.mockResolvedValueOnce({
        rows: [
          { endpoint: 'platform_api', total: '1000', healthy_count: '975' }, // 97.5%
        ],
      });

      const { getPlatformStatus } = await import('./health-probe.js');
      const status = await getPlatformStatus();
      const platformApi = status.services.find((s) => s.name === 'Platform API');
      expect(platformApi?.status).toBe('degraded');
    });
  });
});
