import { Router, type IRouter } from 'express';
import type { Response } from 'express';
import { pool } from '../db.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const instancesRouter: IRouter = Router();

instancesRouter.post('/register', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const agentType = typeof body.agent_type === 'string' ? body.agent_type.trim() : 'generic';

  if (!name || name.length > 80) {
    res.status(400).json({ error: 'name is required and must be under 80 characters' });
    return;
  }

  const { randomUUID } = await import('crypto');
  const instanceId = agentType.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + randomUUID().slice(0, 8);

  try {
    const accountId = req.scoutAuth?.kind === 'account' ? req.scoutAuth.accountId : null;
    await pool.query(
      `INSERT INTO carina_instances (id, name, api_key, status, account_id, last_heartbeat)
       VALUES ($1, $2, $3, 'active', $4, NOW())
       ON CONFLICT (id) DO UPDATE SET last_heartbeat = NOW(), name = EXCLUDED.name`,
      [instanceId, name, '', accountId],
    );
    res.status(201).json({ instance_id: instanceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:instances] register failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});

instancesRouter.get('/:instanceId/status', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
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
