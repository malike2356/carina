import { Router } from 'express';
import { VERLOX_QUICK_ACTIONS } from '../lib/constants.js';

export const chatRouter = Router();

const carinaUrl = () => process.env.CARINA_API_URL ?? 'http://localhost:3333';

chatRouter.get('/', (req, res) => {
  const prefill = String(req.query.prefill ?? '');
  res.render('chat', {
    carinaApiUrl: carinaUrl(),
    quickActions: VERLOX_QUICK_ACTIONS,
    prefill,
  });
});

chatRouter.post('/provider', async (_req, res) => {
  try {
    const r = await fetch(`${carinaUrl()}/api/providers`, { signal: AbortSignal.timeout(5000) });
    res.json(await r.json());
  } catch {
    res.status(503).json({ error: 'Carina offline' });
  }
});
