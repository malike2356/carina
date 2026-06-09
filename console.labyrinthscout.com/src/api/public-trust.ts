import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';

export const publicTrustRouter: IRouter = Router();

publicTrustRouter.get('/', async (_req: Request, res: Response): Promise<void> => {
  if (!config.trust.publicEnabled) {
    res.status(503).json({ error: 'Public trust dashboard is disabled' });
    return;
  }

  try {
    const payload = await buildPublicTrustFromDb();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[public-trust] Query failed:', msg);
    res.status(500).json({ error: 'Trust metrics unavailable' });
  }
});
