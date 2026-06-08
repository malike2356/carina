import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';

export const instancesRouter: IRouter = Router();

instancesRouter.get('/:instanceId/status', async (req: Request, res: Response): Promise<void> => {
  const instanceId =
    typeof req.params.instanceId === 'string' ? req.params.instanceId : '';

  if (!instanceId) {
    res.status(400).json({ error: 'instanceId is required' });
    return;
  }

  try {
    const result = await pool.query<{
      status: string;
      suspension_reason: string | null;
    }>(
      `SELECT status, suspension_reason
       FROM carina_instances
       WHERE id = $1`,
      [instanceId],
    );

    const row = result.rows[0];
    if (!row) {
      res.json({ suspended: false });
      return;
    }

    res.json({
      suspended: row.status === 'suspended',
      reason: row.suspension_reason ?? undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:instances] status query failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
