import { describe, expect, it } from 'vitest';
import { runDeepScan } from './health-deep-scan.js';

describe('health-deep-scan', () => {
  it('returns deep scan checks', async () => {
    const result = await runDeepScan();
    expect(result.checks.length).toBeGreaterThan(0);
    expect(result.checks.some((c) => c.id === 'deep-log-dir')).toBe(true);
  });
});
