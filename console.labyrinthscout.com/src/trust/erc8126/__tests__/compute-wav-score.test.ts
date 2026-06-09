import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db.js', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({
      rows: [{
        runtime_incidents_30d: '0',
        injection_blocks_30d: '0',
        breach_30d: '0',
        egress_blocks_30d: '0',
      }],
    }),
  },
}));

import { computeWavRiskScore, probeEndpoint } from '../compute-wav-score.js';

describe('probeEndpoint', () => {
  it('rejects non-HTTPS endpoints', async () => {
    const result = await probeEndpoint('http://example.com');
    expect(result.ok).toBe(false);
    expect(result.https).toBe(false);
  });

  it('marks reachable HTTPS endpoints as ok', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await probeEndpoint('https://example.com', fetchFn as never);
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
  });
});

describe('computeWavRiskScore', () => {
  it('returns low risk when endpoints are healthy', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const result = await computeWavRiskScore({
      endpoints: ['https://core.carinaai.uk'],
      fetchFn: fetchFn as never,
    });

    expect(result.applicable).toBe(true);
    expect(result.risk_score).toBeLessThanOrEqual(20);
  });

  it('raises risk when endpoints fail', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('timeout'));
    const result = await computeWavRiskScore({
      endpoints: ['https://offline.example'],
      fetchFn: fetchFn as never,
    });

    expect(result.risk_score).toBeGreaterThan(30);
  });
});
