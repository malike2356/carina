import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { instancesRouter } from '../instances.js';

vi.mock('../../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '../../db.js';

function makeApp() {
  const app = express();
  app.use('/api/instances', instancesRouter);
  return app;
}

describe('GET /api/instances/:instanceId/status', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('returns suspended=false when instance not found', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    const res = await request(makeApp()).get('/api/instances/unknown/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suspended: false });
  });

  it('returns suspended=true with reason when instance is suspended', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ status: 'suspended', suspension_reason: 'policy breach' }],
    } as never);
    const res = await request(makeApp()).get('/api/instances/agent-1/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suspended: true, reason: 'policy breach' });
  });

  it('returns suspended=false for active instance', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [{ status: 'active', suspension_reason: null }],
    } as never);
    const res = await request(makeApp()).get('/api/instances/agent-1/status');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ suspended: false });
  });
});
