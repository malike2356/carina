import { Router, type Request, type Response } from 'express';
import { VERLOX_QUICK_ACTIONS } from '../lib/constants.js';
import { CARINA_BASE, carinaGet, carinaHeaders, carinaReachable } from '../lib/carina.js';

export const chatRouter = Router();

const carinaUrl = (): string => CARINA_BASE;

async function loadActiveProvider(): Promise<string | null> {
  const providers = await carinaGet('/api/providers', 12000);
  if (!providers.ok) return null;
  const data = await providers.json() as { active?: string; providers?: string[] };
  return data.active ?? data.providers?.[0] ?? null;
}

chatRouter.get('/', async (req, res) => {
  const prefill = String(req.query.prefill ?? '');
  const coreReachable = await carinaReachable();
  res.render('chat', {
    carinaApiUrl: carinaUrl(),
    coreReachable,
    quickActions: VERLOX_QUICK_ACTIONS,
    prefill,
  });
});

chatRouter.get('/health', async (_req, res) => {
  try {
    const health = await carinaGet('/api/ops/health', 4000);
    if (!health.ok) {
      res.status(503).json({ ok: false, error: `Carina HTTP ${health.status}` });
      return;
    }
    const active = await loadActiveProvider();
    res.json({ ok: true, active });
  } catch {
    res.status(503).json({ ok: false, error: 'Carina offline' });
  }
});

chatRouter.post('/provider', async (_req, res) => {
  try {
    const health = await carinaGet('/api/ops/health', 4000);
    if (!health.ok) {
      res.status(health.status).json({ error: `Carina HTTP ${health.status}` });
      return;
    }
    const active = await loadActiveProvider();
    if (!active) {
      res.status(503).json({ error: 'No active provider' });
      return;
    }
    res.json({ active });
  } catch {
    res.status(503).json({ error: 'Carina offline' });
  }
});

async function proxyChatStream(req: Request, res: Response, message: string, sessionId: string): Promise<void> {
  if (!message.trim()) {
    res.status(400).json({ error: 'message is required' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const url = new URL(`${CARINA_BASE}/api/chat/stream`);
  url.searchParams.set('message', message);
  if (sessionId) url.searchParams.set('sessionId', sessionId);

  try {
    const upstream = await fetch(url, {
      headers: carinaHeaders(),
      signal: AbortSignal.timeout(120000),
    });
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
}

chatRouter.get('/stream', async (req: Request, res: Response) => {
  const message = String(req.query.message ?? '');
  const sessionId = String(req.query.sessionId ?? '');
  await proxyChatStream(req, res, message, sessionId);
});

chatRouter.post('/stream', async (req: Request, res: Response) => {
  const message = String(req.body?.message ?? '');
  const sessionId = String(req.body?.sessionId ?? '');
  await proxyChatStream(req, res, message, sessionId);
});
