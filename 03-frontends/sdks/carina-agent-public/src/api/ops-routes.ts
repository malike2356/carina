import type { Express, Request, Response } from 'express';
import { reloadSecrets } from '../ops/secrets-reload.js';
import { opsToken } from '../ops/ops-config.js';

function authorizeOps(req: Request): boolean {
  const token = opsToken();
  if (!token) return false;
  const header = req.headers.authorization ?? '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const bodyToken = typeof req.body?.token === 'string' ? req.body.token : '';
  return bearer === token || bodyToken === token;
}

export function mountOpsRoutes(app: Express): void {
  app.post('/api/ops/reload-secrets', async (req: Request, res: Response) => {
    if (!authorizeOps(req)) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const result = await reloadSecrets({ overwrite: true, notifyGateway: false });
    res.json({
      ok: true,
      reloaded: result.reloaded.length,
      skipped: result.skipped.length,
    });
  });

  app.get('/api/ops/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'carina-ops' });
  });
}
