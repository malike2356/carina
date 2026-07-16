import { Router } from 'express';
import { carinaGet, carinaPost } from '../lib/carina.js';

export const carinaToolsProxyRouter = Router();

carinaToolsProxyRouter.get('/runtime', async (_req, res) => {
  try {
    const upstream = await carinaGet('/api/carina-ops/tools/runtime');
    const data = await upstream.json() as unknown;
    if (!upstream.ok) {
      res.status(upstream.status).json(data);
      return;
    }
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Carina core unreachable', detail: msg });
  }
});

carinaToolsProxyRouter.post('/runtime/:id/approve', async (req, res) => {
  const id = String(req.params.id ?? '');
  try {
    const upstream = await carinaPost(`/api/carina-ops/tools/runtime/${id}/approve`, {});
    const data = await upstream.json() as unknown;
    res.status(upstream.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Carina core unreachable', detail: msg });
  }
});

carinaToolsProxyRouter.post('/runtime/:id/disable', async (req, res) => {
  const id = String(req.params.id ?? '');
  try {
    const upstream = await carinaPost(`/api/carina-ops/tools/runtime/${id}/disable`, {});
    const data = await upstream.json() as unknown;
    res.status(upstream.status).json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(502).json({ error: 'Carina core unreachable', detail: msg });
  }
});
