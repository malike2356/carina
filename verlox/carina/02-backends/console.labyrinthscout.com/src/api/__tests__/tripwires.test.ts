import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../db.js', () => ({
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

import { tripwiresRouter } from '../tripwires.js';

describe('tripwiresRouter', () => {
  it('returns tripwire config', async () => {
    const app = express();
    app.use('/api/tripwires', tripwiresRouter);
    const res = await request(app).get('/api/tripwires/config');
    expect(res.status).toBe(200);
    expect(res.body.config.length).toBeGreaterThan(0);
  });

  it('returns recent tripwire hits', async () => {
    const app = express();
    app.use('/api/tripwires', tripwiresRouter);
    const res = await request(app).get('/api/tripwires/hits');
    expect(res.status).toBe(200);
    expect(res.body.hits).toEqual([]);
  });
});
