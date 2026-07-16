import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';

export const killswitchRouter: IRouter = Router();

killswitchRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = globalKillSwitch.getStatus();
    const result = await globalKillSwitch['getStatus']();
    // Count active instances for the status response
    const { pool } = await import('../db.js');
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM carina_instances WHERE status = 'active'`,
    );
    const agentsActive = parseInt(countResult.rows[0]?.count ?? '0', 10);

    res.json({
      armed: status.armed,
      triggered: status.triggered,
      triggered_by: status.triggered_by,
      reason: status.reason,
      agents_active: agentsActive,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:killswitch] Status failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

killswitchRouter.post('/trigger', async (req: Request, res: Response): Promise<void> => {
  try {
    const { password, reason } = req.body as Record<string, unknown>;

    if (!password || typeof password !== 'string' || !password.trim()) {
      res.status(400).json({ error: 'Admin password required' });
      return;
    }
    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }
    if (reason.length > 500) {
      res.status(400).json({ error: 'Reason must be 500 characters or fewer' });
      return;
    }

    const adminEmail = typeof (req as any).adminEmail === 'string'
      ? (req as any).adminEmail
      : password;
    const result = await globalKillSwitch.trigger(adminEmail, reason.trim());

    res.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('already triggered')) {
      res.status(409).json({ error: msg });
      return;
    }
    console.error('[scout:killswitch] Trigger failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

killswitchRouter.post('/disarm', async (_req: Request, res: Response): Promise<void> => {
  res.status(403).json({
    error: 'Disarm requires server access. SSH: carina scout disarm',
  });
});
