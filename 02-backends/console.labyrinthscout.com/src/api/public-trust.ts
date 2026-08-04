import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';
import { trustVerifyRouter } from './trust-verify.js';

export const publicTrustRouter: IRouter = Router();

publicTrustRouter.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    next();
    return;
  }
  res.status(405).json({ error: 'Public trust API is read-only' });
});

publicTrustRouter.use('/verify', trustVerifyRouter);

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
