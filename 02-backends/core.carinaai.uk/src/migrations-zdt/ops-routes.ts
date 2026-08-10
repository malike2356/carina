import type { Express, Request, Response } from 'express';
import { authorizeOps } from '../ops/ops-auth.js';
import {
  createAddBeforeDropPlan,
  gateProduction,
  getPlan,
  listPlans,
  markStagingValidated,
  stagingMirror,
} from './plan-store.js';

/**
 * Ops APIs for zero-downtime migration planning.
 * Never runs destructive SQL against production; planning + gates only.
 */
export function mountMigrationsZdtOpsRoutes(app: Express): void {
  app.get('/api/ops/migrations-zdt', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    res.json({ ok: true, plans: listPlans() });
  });

  app.post('/api/ops/migrations-zdt/plan/add-before-drop', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const name = String(req.body?.name || '').trim();
      const table = String(req.body?.table || '').trim();
      const oldColumn = String(req.body?.oldColumn || '').trim();
      const newColumnName = String(req.body?.newColumnName || '').trim();
      if (!name || !table || !oldColumn || !newColumnName) {
        res.status(400).json({ error: 'name, table, oldColumn, newColumnName are required' });
        return;
      }
      const result = createAddBeforeDropPlan({
        name,
        table,
        oldColumn,
        newColumn: {
          name: newColumnName,
          typeSql: String(req.body?.typeSql || 'TEXT'),
          nullable: req.body?.nullable !== false,
          defaultSql: req.body?.defaultSql ? String(req.body.defaultSql) : undefined,
        },
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/ops/migrations-zdt/staging-mirror', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const sourceDatabase = String(req.body?.sourceDatabase || 'carina');
    const stagingDatabase = String(req.body?.stagingDatabase || 'carina_staging');
    res.json({
      ok: true,
      mirror: stagingMirror(sourceDatabase, stagingDatabase),
      note: 'Commands are returned for operator review; this endpoint does not execute them.',
    });
  });

  app.post('/api/ops/migrations-zdt/:name/mark-staging-validated', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const plan = markStagingValidated(String(req.params.name));
      res.json({ ok: true, plan });
    } catch {
      res.status(404).json({ error: 'Plan not found' });
    }
  });

  app.post('/api/ops/migrations-zdt/:name/run-production', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const name = String(req.params.name);
    const plan = getPlan(name);
    if (!plan) {
      res.status(404).json({ error: 'Plan not found' });
      return;
    }
    try {
      const { gate } = gateProduction(name, String(req.body?.confirmToken || ''));
      if (!gate.allowed) {
        res.status(403).json({ error: gate.reason, gate });
        return;
      }
      res.json({
        ok: true,
        dryRun: true,
        gate,
        message:
          'Confirmation accepted. Apply via numbered SQL / deploy tooling with the generated rollback artifacts. This API never executes production DDL.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });
}
