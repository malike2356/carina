import { describe, expect, it, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const queryMock = vi.fn();
const auditMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../audit/audit-logger.js', () => ({
  logAdminAction: (...args: unknown[]) => auditMock(...args),
}));

vi.mock('../../middleware/plan-gate.js', () => ({
  requireScoutPro: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { platformSettingsRouter } from '../platform-settings.js';

describe('/api/admin/platform-settings', () => {
  const settings = new Map<string, string>();

  beforeEach(() => {
    settings.clear();
    queryMock.mockReset();
    auditMock.mockReset();
    queryMock.mockImplementation(async (sql: string, params: unknown[]) => {
      if (sql.includes('SELECT value FROM scout_platform_settings WHERE key = $1')) {
        const key = String(params[0] ?? '');
        const value = settings.has(key) ? settings.get(key)! : null;
        return { rows: value === null ? [] : [{ value }] };
      }
      if (sql.includes('INSERT INTO scout_platform_settings')) {
        const key = String(params[0] ?? '');
        const value = String(params[1] ?? '');
        settings.set(key, value);
        return { rows: [] };
      }
      return { rows: [] };
    });
  });

  function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/api/admin/platform-settings', platformSettingsRouter);
    return app;
  }

  it('reads platform security settings with env fallback when unset', async () => {
    const res = await request(makeApp()).get('/api/admin/platform-settings');

    expect(res.status).toBe(200);
    expect(res.body.settings.egress_filter_enabled).toBe(false);
    expect(res.body.settings.egress_filter_source).toBe('env');
    expect(res.body.settings.sandbox_enabled).toBe(false);
    expect(res.body.settings.sandbox_source).toBe('env');
  });

  it('saves platform security settings through the GUI route', async () => {
    const res = await request(makeApp())
      .put('/api/admin/platform-settings')
      .send({ egress_filter_enabled: true, sandbox_enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.settings.egress_filter_enabled).toBe(true);
    expect(res.body.settings.egress_filter_source).toBe('gui');
    expect(res.body.settings.sandbox_enabled).toBe(true);
    expect(res.body.settings.sandbox_source).toBe('gui');
    expect(settings.get('security_egress_filter_enabled')).toBe('true');
    expect(settings.get('security_sandbox_enabled')).toBe('true');
    expect(auditMock).toHaveBeenCalledOnce();
  });
});
