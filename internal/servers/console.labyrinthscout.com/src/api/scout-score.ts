import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import { getCurrentScoutScore } from '../findings/score.js';
import { listScoreHistory } from '../findings/store.js';

export const scoutScoreRouter: IRouter = Router();

scoutScoreRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const persist = req.query.persist !== 'false';

  try {
    const score = await getCurrentScoutScore(accountId, persist);
    res.json(score);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:score] compute failed:', msg);
    res.status(500).json({ error: 'Failed to compute score' });
  }
});

scoutScoreRouter.get('/history', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 30;

  try {
    const history = await listScoreHistory(
      accountId,
      Number.isFinite(limit) ? limit : 30,
    );
    res.json({ history });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:score] history failed:', msg);
    res.status(500).json({ error: 'Failed to load score history' });
  }
});
