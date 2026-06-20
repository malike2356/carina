import { Router, type Request, type Response } from 'express';
import { scoutGet, scoutPost, SCOUT_BASE, scoutHeaders } from '../lib/scout.js';

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
  const scoutUrl = SCOUT_BASE;
  const data = (await scoutGet('/api/admin/status')) as StatusPayload | null;

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
  const data = await scoutGet('/api/admin/events?limit=50');
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

  const scoutKey = scoutHeaders()['X-Scout-Key'] ?? '';
  const scoutUrl = `${SCOUT_BASE}/api/admin/stream`;

  try {
    const upstream = await fetch(scoutUrl, {
      headers: scoutKey ? { 'X-Scout-Key': scoutKey } : {},
    });

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
  const result = await scoutPost(`/api/admin/kill/${encodeURIComponent(instanceId)}`, { reason });
  if (!result) {
    res.status(503).json({ error: 'Scout offline or kill failed' });
    return;
  }
  res.json(result);
});

securityRouter.post('/resume/:instanceId', async (req, res) => {
  const instanceId = String(req.params.instanceId ?? '');
  const result = await scoutPost(`/api/admin/resume/${encodeURIComponent(instanceId)}`, {});
  if (!result) {
    res.status(503).json({ error: 'Scout offline or resume failed' });
    return;
  }
  res.json(result);
});

// Module sub-pages - all render EJS views that load data client-side from /scout-api
securityRouter.get('/killswitch', (_req, res) => { res.render('security/killswitch', { title: 'Kill Switch' }); });
securityRouter.get('/threats',    (_req, res) => { res.render('security/threats',    { title: 'Live Threats' }); });
securityRouter.get('/incidents',  (_req, res) => { res.render('security/incidents',  { title: 'Incidents' }); });
securityRouter.get('/anomalies',  (_req, res) => { res.render('security/anomalies',  { title: 'Anomalies' }); });
securityRouter.get('/findings',   (_req, res) => { res.render('security/findings',   { title: 'Findings' }); });
securityRouter.get('/attack-surface', (_req, res) => { res.render('security/attack-surface', { title: 'Attack Surface' }); });
securityRouter.get('/honeypots',  (_req, res) => { res.render('security/honeypots',  { title: 'Honeypots' }); });
securityRouter.get('/tripwires',  (_req, res) => { res.render('security/tripwires',  { title: 'Tripwires' }); });
securityRouter.get('/auto-remediate', (_req, res) => { res.render('security/auto-remediate', { title: 'Auto-Remediation' }); });
securityRouter.get('/deception',  (_req, res) => { res.render('security/deception',  { title: 'Deception Traps' }); });
securityRouter.get('/quarantine', (_req, res) => { res.render('security/quarantine', { title: 'Quarantine' }); });
securityRouter.get('/egress',     (_req, res) => { res.render('security/egress',     { title: 'Egress Control' }); });
securityRouter.get('/policy',     (_req, res) => { res.render('security/policy',     { title: 'Policy' }); });
securityRouter.get('/policy-packs', (_req, res) => { res.render('security/policy-packs', { title: 'Policy Packs' }); });
securityRouter.get('/score',      (_req, res) => { res.render('security/score',      { title: 'Scout Score' }); });
securityRouter.get('/reports',    (_req, res) => { res.render('security/reports',    { title: 'Reports' }); });
