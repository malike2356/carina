import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isScoutAgenticApiAuthorized, scoutAgenticDisabledResponse } from './auth.js';
import { runInvestigation } from '../../security/scout/investigation-engine.js';
import { analyzeThreatCluster } from '../../security/scout/ai-threat-analyst.js';

export const scoutInvestigationRouter: ExpressRouter = Router();

scoutInvestigationRouter.post('/v1/investigate', async (req: Request, res: Response) => {
  if (!isScoutAgenticApiAuthorized(req)) {
    const denied = scoutAgenticDisabledResponse();
    res.status(denied.status).json(denied.body);
    return;
  }

  const sessionId = String(req.body?.session_id ?? req.body?.sessionId ?? '').trim();
  if (!sessionId) {
    res.status(400).json({ error: 'session_id is required' });
    return;
  }

  const report = await runInvestigation({
    sessionId,
    reason: typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    requestedBy: typeof req.body?.requested_by === 'string' ? req.body.requested_by : 'scout-api',
  });

  if (!report) {
    res.status(503).json({ error: 'Investigation engine unavailable' });
    return;
  }

  res.json({ ok: true, report });
});

scoutInvestigationRouter.post('/v1/analyse-threat', async (req: Request, res: Response) => {
  if (!isScoutAgenticApiAuthorized(req)) {
    const denied = scoutAgenticDisabledResponse();
    res.status(denied.status).json(denied.body);
    return;
  }

  const report = await analyzeThreatCluster({
    threatId: typeof req.body?.threat_id === 'string' ? req.body.threat_id : undefined,
    clusterId: typeof req.body?.cluster_id === 'string' ? req.body.cluster_id : undefined,
    eventIds: Array.isArray(req.body?.event_ids) ? req.body.event_ids.map(String) : undefined,
    sessionId: typeof req.body?.session_id === 'string' ? req.body.session_id : undefined,
  });

  if (!report) {
    res.status(503).json({ error: 'Threat analyst unavailable' });
    return;
  }

  res.json({ ok: true, report });
});
