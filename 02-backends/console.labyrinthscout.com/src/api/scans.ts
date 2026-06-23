import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { resolveAccountId } from '../findings/account-scope.js';
import { getScanRunById, listScanRuns } from '../findings/store.js';

export const scansRouter: IRouter = Router();

scansRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const targetId = typeof req.query.target_id === 'string' ? req.query.target_id : undefined;
  const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
  const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : undefined;

  try {
    const scans = await listScanRuns(accountId, {
      targetId,
      limit: Number.isFinite(limit) ? limit : undefined,
      offset: Number.isFinite(offset) ? offset : undefined,
    });
    res.json({ scans });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:scans] list failed:', msg);
    res.status(500).json({ error: 'Failed to list scans' });
  }
});

scansRouter.get('/:scanId', async (req: Request, res: Response): Promise<void> => {
  const accountId = resolveAccountId(req, res);
  if (!accountId) return;

  const scanId = typeof req.params.scanId === 'string' ? req.params.scanId : '';
  if (!scanId) {
    res.status(400).json({ error: 'scanId is required' });
    return;
  }

  try {
    const scan = await getScanRunById(accountId, scanId);
    if (!scan) {
      res.status(404).json({ error: 'Scan not found' });
      return;
    }
    res.json(scan);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:scans] get failed:', msg);
    res.status(500).json({ error: 'Failed to load scan' });
  }
});
