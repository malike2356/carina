import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

function mockFreshTenant() {
  poolQueryMock
    .mockResolvedValueOnce({
      rows: [{
        total: '0',
        active: '0',
        promoted: '0',
        quarantined: '0',
        avg_quality: null,
        total_uses: '0',
      }],
    })
    .mockResolvedValueOnce({
      rows: [{ evolved: '0', active: '0' }],
    })
    .mockResolvedValueOnce({
      rows: [{ pending: '0' }],
    });
}

describe('computeCompoundingMetrics', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('returns divergenceScore=0 for a fresh tenant', async () => {
    mockFreshTenant();

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-fresh');

    expect(metrics.divergenceScore).toBe(0);
    expect(metrics.activeTools).toBe(0);
    expect(metrics.promotedTools).toBe(0);
    expect(metrics.evolvedPrompts).toBe(0);
    expect(metrics.tenantId).toBe('tenant-fresh');
  });

  it('divergence increases with active tools', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          total: '10',
          active: '10',
          promoted: '0',
          quarantined: '0',
          avg_quality: 0.8,
          total_uses: '50',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ evolved: '0', active: '0' }] })
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] });

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-1');

    expect(metrics.divergenceScore).toBeGreaterThan(0);
    expect(metrics.divergenceScore).toBeCloseTo(0.2, 2);
  });

  it('divergence increases with promoted tools', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          total: '5',
          active: '5',
          promoted: '5',
          quarantined: '0',
          avg_quality: 0.9,
          total_uses: '25',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ evolved: '0', active: '0' }] })
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] });

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-1');

    expect(metrics.divergenceScore).toBeGreaterThan(0.1);
  });

  it('divergence increases with evolved prompts', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          total: '0',
          active: '0',
          promoted: '0',
          quarantined: '0',
          avg_quality: null,
          total_uses: '0',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ evolved: '3', active: '1' }] })
      .mockResolvedValueOnce({ rows: [{ pending: '0' }] });

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-1');

    expect(metrics.divergenceScore).toBeCloseTo(0.18, 2);
    expect(metrics.evolvedPrompts).toBe(3);
  });

  it('divergence is clamped to 1.0 max', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          total: '50',
          active: '50',
          promoted: '20',
          quarantined: '2',
          avg_quality: 0.95,
          total_uses: '1000',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ evolved: '10', active: '2' }] })
      .mockResolvedValueOnce({ rows: [{ pending: '5' }] });

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-mature');

    expect(metrics.divergenceScore).toBe(1);
  });

  it('returns divergenceScore > 0.4 for 10 active, 5 promoted, 3 evolved', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [{
          total: '15',
          active: '10',
          promoted: '5',
          quarantined: '0',
          avg_quality: 0.85,
          total_uses: '200',
        }],
      })
      .mockResolvedValueOnce({ rows: [{ evolved: '3', active: '1' }] })
      .mockResolvedValueOnce({ rows: [{ pending: '2' }] });

    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-adapted');

    expect(metrics.divergenceScore).toBeGreaterThan(0.4);
    expect(metrics.pendingGapProposals).toBe(2);
  });

  it('sets computedAt to a current ISO timestamp', async () => {
    mockFreshTenant();

    const before = Date.now();
    const { computeCompoundingMetrics } = await import('./compounding.js');
    const metrics = await computeCompoundingMetrics('tenant-1');
    const after = Date.now();

    const parsed = Date.parse(metrics.computedAt);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after + 1000);
  });
});
