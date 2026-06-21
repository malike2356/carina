import { Router, type Request, type Response } from 'express';
import { buildStatusResponse } from './boundary/status.js';
import { listEvents } from './boundary/events.js';
import { sseRouter } from '../event-server/api/sse.js';
import { resumeInstance, suspendInstance, validateKillReason } from '../control/instance-control.js';

export const adminRouter = Router();

adminRouter.get('/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json(await buildStatusResponse());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout-engine:admin] Status failed:', msg);
    res.status(500).json({ error: 'Database unavailable' });
  }
});

adminRouter.get('/events', listEvents);
adminRouter.use('/stream', sseRouter);

adminRouter.post('/kill/:instanceId', async (req: Request, res: Response): Promise<void> => {
  const instanceId = String(req.params.instanceId ?? '');
  if (!instanceId) {
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
    activated_at: activatedAt,
    admin: 'ops.carinaai.uk',
  });
});

adminRouter.post('/resume/:instanceId', async (req: Request, res: Response): Promise<void> => {
  const instanceId = String(req.params.instanceId ?? '');
  if (!instanceId) {
    res.status(400).json({ error: 'Instance id required' });
    return;
  }

  const result = await resumeInstance(instanceId);
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }

  res.json({ ok: true, instance_id: result.instance_id, status: result.status });
});
