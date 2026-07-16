import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isScoutAgenticApiAuthorized, scoutAgenticDisabledResponse } from './auth.js';
import {
  getCachedProactiveRecommendations,
  runProactiveAdvisor,
} from '../../security/scout/proactive-advisor.js';
import { adviseAutoResponse } from '../../security/scout/response-advisor.js';

export const scoutRecommendationsRouter: ExpressRouter = Router();

scoutRecommendationsRouter.get('/v1/recommendations', async (req: Request, res: Response) => {
  if (!isScoutAgenticApiAuthorized(req)) {
    const denied = scoutAgenticDisabledResponse();
    res.status(denied.status).json(denied.body);
    return;
  }

  const refresh = req.query.refresh === 'true' || req.query.refresh === '1';
  if (refresh) {
    await runProactiveAdvisor();
  }

  const cached = getCachedProactiveRecommendations();
  if (cached.recommendations.length === 0 && !refresh) {
    const recommendations = await runProactiveAdvisor();
    res.json({ ok: true, generatedAt: new Date().toISOString(), recommendations });
    return;
  }

  res.json({ ok: true, generatedAt: cached.generatedAt, recommendations: cached.recommendations });
});

scoutRecommendationsRouter.post('/v1/response-advice', async (req: Request, res: Response) => {
  if (!isScoutAgenticApiAuthorized(req)) {
    const denied = scoutAgenticDisabledResponse();
    res.status(denied.status).json(denied.body);
    return;
  }

  const eventType = String(req.body?.event_type ?? req.body?.eventType ?? '').trim();
  const severity = String(req.body?.severity ?? 'warning').trim();
  if (!eventType) {
    res.status(400).json({ error: 'event_type is required' });
    return;
  }

  const advice = adviseAutoResponse({
    eventType,
    severity,
    threatScore: typeof req.body?.threat_score === 'number' ? req.body.threat_score : undefined,
    sessionId: typeof req.body?.session_id === 'string' ? req.body.session_id : undefined,
    instanceId: typeof req.body?.instance_id === 'string' ? req.body.instance_id : undefined,
    correlatedEventCount: typeof req.body?.correlated_event_count === 'number'
      ? req.body.correlated_event_count
      : undefined,
    tier: req.body?.tier,
    metadata: typeof req.body?.metadata === 'object' && req.body.metadata
      ? req.body.metadata as Record<string, unknown>
      : undefined,
  });

  res.json({ ok: true, advice });
});
