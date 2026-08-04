import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { scopedAccountId } from '../lib/scope.js';
import { loadOverviewMetrics } from '../dashboard/load-overview-metrics.js';

export const statsRouter: IRouter = Router();

statsRouter.get('/egress-blocked', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM security_events
       WHERE event_type = 'egress_blocked'
         AND created_at > NOW() - INTERVAL '24 hours'`,
    );
    res.json({ count: Number(result.rows[0]?.count ?? 0), window: '24h' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:stats] egress-blocked query failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

statsRouter.get('/overview', async (req: Request, res: Response): Promise<void> => {
  try {
    const accountId = scopedAccountId(req);
    const metrics = await loadOverviewMetrics(accountId);
    res.json(metrics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:stats] overview failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
