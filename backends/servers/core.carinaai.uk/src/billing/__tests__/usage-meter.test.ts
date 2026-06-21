import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../memory/db.js', () => ({ pool: { query } }));

describe('UsageMeter', () => {
  beforeEach(() => query.mockReset());

  it('calculates overage cost at 0.002 GBP per 1K tokens', async () => {
    const { estimateTokenCost } = await import('../usage-meter.js');
    expect(estimateTokenCost(10_000)).toBe(0.02);
  });

  it('returns the documented 80 percent warning', async () => {
    const { UsageMeter } = await import('../usage-meter.js');
    query.mockResolvedValue({ rows: [{ total: '400000' }] });
    await expect(new UsageMeter().status('tenant-1', 'scout_standard')).resolves.toMatchObject({
      warning: "You've used 400K of 500K tokens this month",
    });
  });

  it('returns the documented 100 percent block', async () => {
    const { UsageMeter } = await import('../usage-meter.js');
    query.mockResolvedValue({ rows: [{ total: '500000' }] });
    await expect(new UsageMeter().status('tenant-1', 'scout_standard')).resolves.toMatchObject({
      blocked: "You've used 500K of 500K tokens this month. Upgrade to continue.",
    });
  });
});
