import { Router, type IRouter, type Request, type Response } from 'express';
import { buildLearningRecap } from '../skills/learning-recap.js';
import {
  getLearningLoopMetrics,
  listAcceptedImprovements,
  listLearnedPreferences,
} from '../skills/learning-ops.js';

export const learningApiRouter: IRouter = Router();

function tenantIdFromRequest(req: Request): string {
  const header = req.header('x-carina-tenant-id');
  if (header?.trim()) return header.trim();
  return process.env.CARINA_TENANT_ID ?? '__operator__';
}

learningApiRouter.get('/status', async (req: Request, res: Response) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const metrics = await getLearningLoopMetrics(tenantId);
    res.json({
      ...metrics,
      taskOutcomesEnabled: process.env.CARINA_TASK_OUTCOMES !== 'false',
      workshopEnabled: process.env.CARINA_SKILL_WORKSHOP === 'true',
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

learningApiRouter.get('/recap', async (req: Request, res: Response) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const days = Number(req.query.days ?? 7);
    const recap = await buildLearningRecap(tenantId, { days });
    res.json(recap);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

learningApiRouter.get('/improvements', async (req: Request, res: Response) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const limit = Number(req.query.limit ?? 30);
    const improvements = await listAcceptedImprovements(tenantId, limit);
    res.json({ improvements });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

learningApiRouter.get('/preferences', async (req: Request, res: Response) => {
  try {
    const tenantId = tenantIdFromRequest(req);
    const limit = Number(req.query.limit ?? 30);
    const preferences = await listLearnedPreferences(tenantId, limit);
    res.json({ preferences });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
