import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { pool } from '../db.js';

export const killswitchRouter: IRouter = Router();

export async function buildKillSwitchStatusPayload(): Promise<Record<string, unknown>> {
  await globalKillSwitch.loadState().catch(() => undefined);
  const status = globalKillSwitch.getStatus();
  const snapshot = globalKillSwitch.getSnapshot();

  let agentsActive = 0;
  try {
    const countResult = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM carina_instances WHERE status = 'active'`,
    );
    agentsActive = Number.parseInt(countResult.rows[0]?.count ?? '0', 10) || 0;
  } catch {
    agentsActive = 0;
  }

  return {
    // Legacy: backend "armed" means standby ready, not halt-active.
    armed: status.armed,
    triggered: status.triggered,
    halted: status.triggered,
    active: status.triggered,
    state: status.triggered ? 'halted' : 'standby',
    triggered_by: snapshot.triggeredBy,
    reason: snapshot.reason,
    triggered_at: snapshot.triggeredAt,
    agents_active: agentsActive,
  };
}

function resolveActor(req: Request, body: Record<string, unknown>): string {
  if (typeof body.password === 'string' && body.password.trim()) {
    return body.password.trim();
  }
  const sessionEmail = (req as { session?: { accountEmail?: string } }).session?.accountEmail;
  if (typeof sessionEmail === 'string' && sessionEmail.trim()) {
    return sessionEmail.trim();
  }
  const accountId = (req as { scoutAuth?: { accountId?: string } }).scoutAuth?.accountId;
  if (typeof accountId === 'string' && accountId.trim()) {
    return `account:${accountId.trim()}`;
  }
  return 'console-operator';
}

killswitchRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await buildKillSwitchStatusPayload());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:killswitch] Status failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

killswitchRouter.post('/trigger', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) {
      res.status(400).json({ error: 'Reason is required' });
      return;
    }
    if (reason.length > 500) {
      res.status(400).json({ error: 'Reason must be 500 characters or fewer' });
      return;
    }

    const result = await globalKillSwitch.trigger(resolveActor(req, body), reason);
    res.json({ ...result, status: await buildKillSwitchStatusPayload() });
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

killswitchRouter.post('/disarm', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reason = typeof body.reason === 'string' && body.reason.trim()
      ? body.reason.trim()
      : 'Disarmed from Scout console';
    await globalKillSwitch.disarm(resolveActor(req, body), reason);
    res.json({ ok: true, status: await buildKillSwitchStatusPayload() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:killswitch] Disarm failed:', msg);
    res.status(500).json({ error: msg || 'Internal server error' });
  }
});
