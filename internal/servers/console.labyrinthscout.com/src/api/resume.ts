import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resumeInstance } from '../lib/instance-control.js';

export const resumeRouter: IRouter = Router();

resumeRouter.post('/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const instanceId = req.params.instanceId;
    if (!instanceId || Array.isArray(instanceId)) {
      res.status(400).json({ error: 'Instance id required' });
      return;
    }

    const result = await resumeInstance(instanceId);
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.json({ ok: true, instance_id: result.instance_id, status: result.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:resume] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
