import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { isScoutAgenticApiAuthorized, scoutAgenticDisabledResponse } from './auth.js';
import { runNlSecurityQuery } from '../../security/scout/nl-query-handler.js';

export const scoutNlQueryRouter: ExpressRouter = Router();

scoutNlQueryRouter.post('/v1/query', async (req: Request, res: Response) => {
  if (!isScoutAgenticApiAuthorized(req)) {
    const denied = scoutAgenticDisabledResponse();
    res.status(denied.status).json(denied.body);
    return;
  }

  const query = String(req.body?.query ?? '').trim();
  if (!query) {
    res.status(400).json({ error: 'query is required' });
    return;
  }
  if (query.length > 2000) {
    res.status(400).json({ error: 'query must be 2000 characters or fewer' });
    return;
  }

  const result = await runNlSecurityQuery(query);
  if (!result) {
    res.status(503).json({ error: 'NL query handler unavailable' });
    return;
  }

  res.json({ ok: true, result });
});
