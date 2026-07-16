import { Router, type Request, type Response } from 'express';
import {
  loadWardenConfig,
  persistWardenSchedule,
  updateWardenConfig,
} from '../warden/config.js';
import {
  enqueueScan,
  getEvidenceList,
  getScan,
  getThreat,
  getWardenStatus,
  listEvents,
  listScans,
  listThreats,
  manualRespond,
  restartWardenScheduler,
} from '../warden/engine.js';
import type { ResponseAction, ScanJob } from '../warden/types.js';

export const wardenRouter = Router();

const RESPONSE_ACTIONS = new Set<ResponseAction>([
  'log',
  'flag',
  'isolate',
  'sandbox',
  'immobilize',
  'strip',
  'remove',
  'kill_carina',
  'lock_host',
]);

function objectBody(req: Request, res: Response): Record<string, unknown> | null {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ error: 'JSON object body required' });
    return null;
  }
  return req.body as Record<string, unknown>;
}

wardenRouter.get('/status', async (_req, res) => {
  res.json(await getWardenStatus());
});

wardenRouter.get('/threats', (_req, res) => {
  res.json({ threats: listThreats() });
});

wardenRouter.get('/threats/:id', (req, res) => {
  const threat = getThreat(String(req.params.id));
  if (!threat) {
    res.status(404).json({ error: 'Threat not found' });
    return;
  }
  res.json({ threat });
});

wardenRouter.get('/events', (req, res) => {
  const requested = Number.parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(500, requested)) : 100;
  res.json({ events: listEvents(limit) });
});

wardenRouter.get('/scans', (req, res) => {
  const requested = Number.parseInt(String(req.query.limit ?? '20'), 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(100, requested)) : 20;
  res.json({ scans: listScans(limit) });
});

wardenRouter.get('/scans/:id', (req, res) => {
  const scan = getScan(String(req.params.id));
  if (!scan) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }
  res.json({ scan });
});

wardenRouter.get('/evidence', (_req, res) => {
  res.json({ evidence: getEvidenceList() });
});

wardenRouter.get('/config', (_req, res) => {
  res.json(loadWardenConfig());
});

wardenRouter.post('/scan', (req, res) => {
  const body = objectBody(req, res);
  if (!body) return;
  const mode = body.mode ?? 'full';
  if (mode !== 'quick' && mode !== 'full' && mode !== 'deep') {
    res.status(400).json({ error: 'mode must be quick, full, or deep' });
    return;
  }
  res.status(202).json({ scan: enqueueScan(mode as ScanJob['mode']) });
});

wardenRouter.post('/scan/:mode', (req, res) => {
  const mode = String(req.params.mode);
  if (mode !== 'quick' && mode !== 'full' && mode !== 'deep') {
    res.status(400).json({ error: 'mode must be quick, full, or deep' });
    return;
  }
  res.status(202).json({ scan: enqueueScan(mode) });
});

wardenRouter.patch('/config', (req, res) => {
  const body = objectBody(req, res);
  if (!body) return;
  res.json(updateWardenConfig(body));
});

wardenRouter.patch('/schedule', (req, res) => {
  const body = objectBody(req, res);
  if (!body) return;
  const schedule: Record<string, number> = {};
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      res.status(400).json({ error: `Invalid schedule value for ${key}` });
      return;
    }
    schedule[key] = value;
  }
  const config = persistWardenSchedule(schedule);
  restartWardenScheduler();
  res.json({ schedule: config.schedule });
});

wardenRouter.post('/threats/:id/respond', async (req, res) => {
  const body = objectBody(req, res);
  if (!body) return;
  const actions = body.actions;
  if (
    actions !== undefined &&
    (!Array.isArray(actions) || actions.some((action) => !RESPONSE_ACTIONS.has(action as ResponseAction)))
  ) {
    res.status(400).json({ error: 'actions contains an unsupported response action' });
    return;
  }
  const result = await manualRespond(String(req.params.id), {
    confirmedRemove: body.confirmed_remove === true,
    instanceId: typeof body.instance_id === 'string' ? body.instance_id : undefined,
    onlyActions: actions as ResponseAction[] | undefined,
  });
  res.status(result.ok ? 200 : 404).json(result);
});
