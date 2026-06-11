import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { publicTrustRouter } from '../public-trust.js';
import { evaluateDataFreshness } from '../../trust/compute-trust-metrics.js';

vi.mock('../../trust/build-public-trust.js', () => ({
  buildPublicTrustFromDb: vi.fn(),
}));

import { buildPublicTrustFromDb } from '../../trust/build-public-trust.js';

function makeApp() {
  const app = express();
  app.use('/api/public/trust', publicTrustRouter);
  return app;
}

describe('GET /api/public/trust', () => {
  beforeEach(() => {
    vi.mocked(buildPublicTrustFromDb).mockReset();
  });

  it('returns public trust metrics without an API key', async () => {
    vi.mocked(buildPublicTrustFromDb).mockResolvedValue({
      generated_at: '2026-06-09T12:00:00.000Z',
      risk_score: 12,
      risk_tier: 'low',
      risk_tier_label: 'Low risk',
      monitoring: {
        scout_active: true,
        agents_protected: 1,
        agents_active: 1,
        agents_suspended: 0,
        last_scan_at: '2026-06-09T11:59:00.000Z',
        last_scan_relative: '1 minute ago',
        last_heartbeat_at: '2026-06-09T11:59:00.000Z',
      },
      metrics: {
        injection_blocks_24h: 0,
        runtime_incidents_30d: 0,
        events_today: 42,
        threats_24h: 0,
        blocked_24h: 0,
      },
      attestations: [],
      chain: {
        erc8004_status: 'registering',
        erc8004_label: 'Registering on Base Sepolia',
        erc8126_status: 'enterprise',
        erc8126_label: 'Enterprise tier; Q3 2026',
      },
      source: 'labyrinth-scout',
    });

    const res = await request(makeApp()).get('/api/public/trust');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('max-age=60');
    expect(res.body.risk_score).toBe(12);
    expect(res.body.source).toBe('labyrinth-scout');
  });

  it('rejects mutating methods on the public trust API', async () => {
    const res = await request(makeApp()).post('/api/public/trust');
    expect(res.status).toBe(405);
    expect(res.body.error).toContain('read-only');
  });

  it('returns 500 when metrics cannot be built', async () => {
    vi.mocked(buildPublicTrustFromDb).mockRejectedValue(new Error('db down'));

    const res = await request(makeApp()).get('/api/public/trust');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Trust metrics unavailable');
  });
});

describe('evaluateDataFreshness', () => {
  it('treats a recent heartbeat as fresh even when no recent event exists', () => {
    const now = new Date('2026-06-10T22:40:00.000Z');
    const freshness = evaluateDataFreshness(
      {
        agentsTotal: 1,
        agentsActive: 1,
        agentsSuspended: 0,
        runtimeIncidents30d: 0,
        warning24h: 0,
        breach30d: 0,
        eventsToday: 0,
        injectionBlocks24h: 0,
        blocked24h: 0,
        threats24h: 0,
        lastEventAt: null,
        lastHeartbeatAt: '2026-06-10T22:35:00.000Z',
      },
      now,
    );

    expect(freshness.stale).toBe(false);
    expect(freshness.stale_reason).toBeNull();
  });
});
