import { Router, type IRouter, type Request, type Response } from 'express';
import { proxyScoutEngineJson, scoutEngineEnabled } from '../lib/scout-engine-client.js';

export const wardenProxyRouter: IRouter = Router();

wardenProxyRouter.use(async (req: Request, res: Response): Promise<void> => {
  if (!scoutEngineEnabled()) {
    res.status(503).json({
      error: 'Scout engine unavailable',
      hint: 'WARDEN API is served by scout-engine. Set SCOUT_ENGINE_URL.',
    });
    return;
  }

  const method = (req.method || 'GET').toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const subPath = req.path === '/' ? '' : req.path;
  const proxied = await proxyScoutEngineJson(req, res, {
    method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: `/api/warden${subPath}`,
    body: method === 'GET' || method === 'DELETE' ? undefined : req.body,
    headers: typeof req.headers['x-scout-key'] === 'string' && req.headers['x-scout-key'].trim()
      ? { 'X-Scout-Key': req.headers['x-scout-key'].trim() }
      : undefined,
  });

  if (!proxied) {
    res.status(502).json({ error: 'Scout engine unavailable' });
  }
});
