import { Router, type IRouter } from 'express';
import {
  getTripwireConfig,
  listRecentTripwireHits,
} from '../security/tripwire-registry.js';

export const tripwiresRouter: IRouter = Router();

tripwiresRouter.get('/config', (_req, res) => {
  res.json({ config: getTripwireConfig() });
});

tripwiresRouter.get('/hits', async (_req, res) => {
  try {
    const limit = 20;
    const hits = await listRecentTripwireHits(limit);
    res.json({ hits });
  } catch (err) {
    console.error('[scout:tripwires] hits failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
