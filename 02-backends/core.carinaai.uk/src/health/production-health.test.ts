import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../memory/db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
}));

import { readFile, readdir, stat } from 'node:fs/promises';
import { pool } from '../memory/db.js';
import { buildProductionHealthPayload } from './production-health.js';

describe('buildProductionHealthPayload', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [{ '?column?': 1 }] } as never);
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (String(path).includes('backup-last-success')) {
        return String(Math.floor(Date.now() / 1000) - 3600);
      }
      if (String(path).includes('cron-heartbeat')) {
        return String(Math.floor(Date.now() / 1000) - 120);
      }
      throw new Error('missing');
    });
    vi.mocked(readdir).mockResolvedValue(['000000010000000000000001'] as never);
    vi.mocked(stat).mockResolvedValue({ mtimeMs: Date.now() } as never);
  });

  it('returns ok when database and heartbeats are fresh', async () => {
    const payload = await buildProductionHealthPayload();
    expect(payload.status).toBe('ok');
    expect(payload.checks.database).toBe('ok');
    expect(payload.checks.backup).toBe('ok');
    expect(payload.checks.cron_scheduler).toBe('ok');
    expect(payload.service).toBe('carina-core');
  });

  it('returns degraded when database fails', async () => {
    vi.mocked(pool.query).mockRejectedValueOnce(new Error('db down'));
    const payload = await buildProductionHealthPayload();
    expect(payload.status).toBe('degraded');
    expect(payload.checks.database).toBe('fail');
  });

  it('warns when cron heartbeat is stale', async () => {
    vi.mocked(readFile).mockImplementation(async (path) => {
      if (String(path).includes('cron-heartbeat')) {
        return String(Math.floor(Date.now() / 1000) - 900);
      }
      if (String(path).includes('backup-last-success')) {
        return String(Math.floor(Date.now() / 1000) - 3600);
      }
      throw new Error('missing');
    });
    const payload = await buildProductionHealthPayload();
    expect(payload.checks.cron_scheduler).toBe('warn');
  });
});
