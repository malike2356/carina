import type { Express, Request, Response } from 'express';
import { reloadSecrets } from '../ops/secrets-reload.js';
import { authorizeOps } from '../ops/ops-auth.js';
import {
  getLastOperatorPackAudit,
  listOperatorInstalledPacks,
  listRecentOperatorPackAudit,
  syncOperatorActivePacks,
} from '../skills/operator-pack-store.js';
import { listAvailablePacks } from '../skills/index.js';
import { getWebPasswordStatus, setWebPassword } from '../ops/web-password.js';

export function mountOpsRoutes(app: Express): void {
  app.post('/api/ops/reload-secrets', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reloadSecrets({ overwrite: true, notifyGateway: false });
    res.json({
      ok: true,
      reloaded: result.reloaded.length,
      skipped: result.skipped.length,
    });
  });

  app.get('/api/ops/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'carina-ops' });
  });

  app.get('/api/ops/skill-packs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const available = listAvailablePacks();
    const installed = await listOperatorInstalledPacks();
    const active = installed
      .filter((row) => row.status === 'installed')
      .map((row) => row.pack_name);
    const lastChange = await getLastOperatorPackAudit();
    const audit = await listRecentOperatorPackAudit(5);
    res.json({
      available,
      active,
      installed,
      lastChange,
      audit,
      source: 'persisted',
    });
  });

  app.put('/api/ops/skill-packs', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const raw = req.body?.packs;
    const packs = Array.isArray(raw)
      ? raw.map(String)
      : typeof raw === 'string'
        ? raw.split(',')
        : [];
    const actor = typeof req.body?.actor === 'string' ? req.body.actor.trim() : 'ops-admin';
    const source = typeof req.body?.source === 'string' ? req.body.source.trim() : 'ops';
    const known = new Set(listAvailablePacks().map((pack) => pack.name));
    const versions = Object.fromEntries(listAvailablePacks().map((pack) => [pack.name, pack.version]));
    const invalid = packs.map((name) => name.trim()).filter(Boolean).filter((name) => !known.has(name));
    if (invalid.length > 0) {
      res.status(400).json({
        error: 'Unknown or incompatible skill packs',
        invalid,
        available: [...known].sort(),
      });
      return;
    }
    try {
      const result = await syncOperatorActivePacks(packs, { actor, source, versions });
      res.json({
        ok: true,
        active: result.active,
        added: result.added,
        removed: result.removed,
        lastChange: await getLastOperatorPackAudit(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg || 'Failed to save skill packs' });
    }
  });

  app.get('/api/ops/web-password', (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json(getWebPasswordStatus());
  });

  app.get('/api/ops/extensions', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { listExtensions } = await import('../extensions/manager.js');
    const extensions = await listExtensions();
    res.json({
      extensions,
      runtimeEnabled: process.env.CARINA_EXTENSIONS_ENABLED === 'true',
      source: 'read-only',
    });
  });

  app.get('/api/ops/eval-reports', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { listRecentReports, loadReport } = await import('../skills/eval/report.js');
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const runId = typeof req.query.runId === 'string' ? req.query.runId : '';
    if (runId) {
      const report = await loadReport(runId);
      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }
      res.json(report);
      return;
    }
    const reports = await listRecentReports(limit);
    res.json({
      reports: reports.map((r) => ({
        runId: r.runId,
        generatedAt: r.generatedAt,
        pack: r.result.pack,
        passRate: r.result.metrics.passRate,
        summary: r.summary,
      })),
    });
  });

  app.put('/api/ops/web-password', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body?.confirmPassword === 'string'
      ? req.body.confirmPassword
      : '';
    const actor = typeof req.body?.actor === 'string' ? req.body.actor.trim() : 'ops-admin';
    try {
      const result = await setWebPassword(password, confirmPassword, actor);
      res.json({ ok: true, ...getWebPasswordStatus(), updatedAt: result.updatedAt });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(400).json({ error: msg });
    }
  });
}
