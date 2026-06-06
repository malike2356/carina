import { Router } from 'express';
import { scoutGet } from '../lib/scout.js';

export const settingsRouter = Router();

settingsRouter.get('/', (_req, res) => {
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'changeme';
  res.render('settings', {
    title: 'Settings',
    carinaApiUrl: process.env.CARINA_API_URL ?? 'http://localhost:3333',
    scoutUrl: process.env.SCOUT_URL ?? 'http://localhost:4444',
    adminPasswordSet: adminPassword !== 'changeme',
    skillAutoWrite: process.env.SKILL_AUTO_WRITE === 'true',
    port: process.env.PORT ?? '4000',
  });
});

settingsRouter.post('/test-carina', async (_req, res) => {
  const carinaUrl = process.env.CARINA_API_URL ?? 'http://localhost:3333';
  try {
    const r = await fetch(`${carinaUrl}/api/providers`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) {
      res.json({ ok: false, error: `HTTP ${r.status}` });
      return;
    }
    const data = (await r.json()) as {
      providers?: string[];
      active?: string;
    };
    res.json({
      ok: true,
      providers: data.providers ?? [],
      active: data.active ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ ok: false, error: msg });
  }
});

settingsRouter.post('/test-scout', async (_req, res) => {
  const data = (await scoutGet('/api/status')) as { instances?: unknown[] } | null;
  if (!data) {
    res.json({ ok: false });
    return;
  }
  res.json({ ok: true, instances: data.instances ?? [] });
});
