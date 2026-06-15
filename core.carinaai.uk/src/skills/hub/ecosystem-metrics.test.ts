import { describe, expect, it } from 'vitest';
import { buildEcosystemMetrics } from './ecosystem-metrics.js';

describe('ecosystem-metrics', () => {
  it('returns measurable ecosystem summary', async () => {
    const metrics = await buildEcosystemMetrics();
    expect(metrics.marketplace.total).toBeGreaterThan(0);
    expect(metrics.proof.measurableOutcomes.length).toBeGreaterThan(0);
  });
});
