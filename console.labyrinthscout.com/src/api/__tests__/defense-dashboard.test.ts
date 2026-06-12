import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('../../security/tripwire-registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../security/tripwire-registry.js')>();
  return {
    ...actual,
    listRecentTripwireHits: vi.fn().mockResolvedValue([]),
  };
});

import { dashboardRouter } from '../dashboard.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/dashboard', dashboardRouter);
  return app;
}

describe('GET /api/dashboard/defense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns grouped defense payload', async () => {
    const app = buildApp();
    const res = await request(app).get('/api/dashboard/defense?session_id=sess-1&instance_id=inst-1');
    expect(res.status).toBe(200);
    expect(res.body.capabilities).toBeInstanceOf(Array);
    expect(res.body.packs.length).toBeGreaterThan(0);
    expect(res.body.remediation_rules.length).toBeGreaterThan(0);
    expect(res.body.tripwire_config.length).toBeGreaterThan(0);
    expect(res.body.terminal).toBeTruthy();
  });
});
