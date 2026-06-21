import { Router, type Request, type Response } from 'express';
import { VERLOX_QUICK_ACTIONS } from '../lib/constants.js';
import { CARINA_BASE, carinaGet, carinaHeaders } from '../lib/carina.js';

export const chatRouter = Router();

const carinaUrl = (): string => CARINA_BASE;

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
    const r = await carinaGet('/api/providers');
    if (!r.ok) {
      res.status(r.status).json({ error: `Carina HTTP ${r.status}` });
      return;
    }
    res.json(await r.json());
  } catch {
    res.status(503).json({ error: 'Carina offline' });
  }
});

chatRouter.get('/stream', async (req: Request, res: Response) => {
  const message = String(req.query.message ?? '');
  const sessionId = String(req.query.sessionId ?? '');

  if (!message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const url = new URL(`${CARINA_BASE}/api/chat/stream`);
  url.searchParams.set('message', message);
  if (sessionId) url.searchParams.set('sessionId', sessionId);

  try {
    const upstream = await fetch(url, { headers: carinaHeaders() });
    if (!upstream.ok || !upstream.body) {
      res.write(`data: ${JSON.stringify({ error: `Carina HTTP ${upstream.status}` })}\n\n`);
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: 'Carina unreachable' })}\n\n`);
  }
  res.end();
});
