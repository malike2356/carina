import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { suspendInstance, validateKillReason } from '../lib/instance-control.js';

export const killRouter: IRouter = Router();

killRouter.post('/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const instanceId = req.params.instanceId;
    if (!instanceId || Array.isArray(instanceId)) {
      res.status(400).json({ error: 'Instance id required' });
      return;
    }

    const validated = validateKillReason(req.body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const result = await suspendInstance(instanceId, validated.reason);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const activatedAt = new Date().toISOString();
    res.json({
      ok: true,
      instance_id: result.instance_id,
      status: result.status,
      confirmation: `KILL SWITCH ACTIVATED - ${activatedAt} by operator`,
      prompt: 'This will immediately stop all active agents. Are you sure?',
      activated_at: activatedAt,
      admin: 'operator',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:kill] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
