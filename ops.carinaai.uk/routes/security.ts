import { Router, type Request, type Response } from 'express';
import { scoutGet, scoutPost, SCOUT_BASE } from '../lib/scout.js';

export const securityRouter = Router();

interface ScoutStats {
  critical: number;
  warning: number;
  info: number;
  breach: number;
}

interface ScoutInstance {
  id: string;
  name: string;
  status: string;
  last_heartbeat: string | null;
  secondsAgo?: number | null;
  suspension_reason?: string | null;
}

interface StatusPayload {
  instances?: ScoutInstance[];
  stats?: ScoutStats;
}

function emptyStats(): ScoutStats {
  return { critical: 0, warning: 0, info: 0, breach: 0 };
}

securityRouter.get('/', async (_req, res) => {
  const scoutUrl = process.env.SCOUT_URL ?? 'http://localhost:4444';
  const data = (await scoutGet('/api/status')) as StatusPayload | null;

  if (!data) {
    res.render('security', {
      title: 'Security',
      scoutOnline: false,
      stats: emptyStats(),
      instances: [] as ScoutInstance[],
      scoutUrl,
    });
    return;
  }

  res.render('security', {
    title: 'Security',
    scoutOnline: true,
    stats: data.stats ?? emptyStats(),
    instances: data.instances ?? [],
    scoutUrl,
  });
});

securityRouter.get('/events', async (_req, res) => {
  const data = await scoutGet('/api/events?limit=50');
  if (!data) {
    res.status(503).json({ error: 'Scout offline' });
    return;
  }
  res.json(data);
});

securityRouter.get('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const scoutUrl = `${SCOUT_BASE}/api/stream`;

  try {
    const upstream = await fetch(scoutUrl);

    if (!upstream.ok || !upstream.body) {
      res.write('data: {"type":"offline"}\n\n');
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
    res.write('data: {"type":"offline"}\n\n');
  }
  res.end();
});

securityRouter.post('/kill/:instanceId', async (req, res) => {
  const instanceId = String(req.params.instanceId ?? '');
  const reason = String((req.body as { reason?: string }).reason ?? 'ops panel kill');
  const result = await scoutPost(`/api/kill/${encodeURIComponent(instanceId)}`, { reason });
  if (!result) {
    res.status(503).json({ error: 'Scout offline or kill failed' });
    return;
  }
  res.json(result);
});

securityRouter.post('/resume/:instanceId', async (req, res) => {
  const instanceId = String(req.params.instanceId ?? '');
  const result = await scoutPost(`/api/resume/${encodeURIComponent(instanceId)}`, {});
  if (!result) {
    res.status(503).json({ error: 'Scout offline or resume failed' });
    return;
  }
  res.json(result);
});
