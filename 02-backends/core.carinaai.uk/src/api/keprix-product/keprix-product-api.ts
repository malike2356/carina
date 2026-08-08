"""Carina/Aiva southbound product API for Keprix connector (CAS-03).

Mounted at /api/keprix/v1/*. Default-deny for undeclared routes is enforced
by the Keprix ProductApiConnector; this module only implements the allowlist.
"""

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Express, Request, Response } from 'express';

type Ctx = {
  workspace_id: string;
  workspace_name?: string;
  actor_id?: string;
  entitlements?: string[];
  soft_wall_pending_count?: number;
  plan?: string;
  product?: string;
  password?: string;
  token?: string;
};

const idempotentApplies = new Map<string, Record<string, unknown>>();

function sharedToken(): string {
  return (
    process.env.CARINA_KEPRIX_SHARED_TOKEN
    ?? process.env.KEPRIX_CARINA_SHARED_TOKEN
    ?? ''
  ).trim();
}

function requireBootstrap(req: Request, res: Response): boolean {
  const expected = sharedToken();
  if (!expected) {
    res.status(503).json({ error: 'shared token not configured', code: 'not_configured' });
    return false;
  }
  const auth = String(req.headers.authorization ?? '');
  const got = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ error: 'denied', code: 'denied' });
    return false;
  }
  return true;
}

function projectContext(raw: Ctx, purpose: string): Record<string, unknown> {
  const out: Record<string, unknown> = { purpose };
  const allowed = [
    'workspace_id',
    'workspace_name',
    'actor_id',
    'entitlements',
    'soft_wall_pending_count',
    'plan',
    'product',
  ] as const;
  for (const key of allowed) {
    if (raw[key] !== undefined) out[key] = raw[key];
  }
  return out;
}

export function mountKeprixProductApi(app: Express): void {
  app.get('/api/keprix/v1/health', (_req, res) => {
    res.json({
      status: 'ok',
      product: 'carina',
      soft_wall_bus: 'product',
      contract_version: '1.0.0',
    });
  });

  app.get('/api/keprix/v1/capabilities', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    res.json({
      product: 'carina',
      actions: [
        'context',
        'token.exchange',
        'events.ack',
        'soft_wall.pending',
        'crm.record.read',
        'approvals.ack',
        'crm.propose.apply',
      ],
      default_deny: true,
    });
  });

  app.post('/api/keprix/v1/token/exchange', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    const workspace_id = String(req.body?.workspace_id ?? '').trim();
    const actor_id = String(req.body?.actor_id ?? 'operator').trim();
    if (!workspace_id) {
      res.status(422).json({ error: 'workspace_id required', code: 'validation' });
      return;
    }
    const exp = Math.floor(Date.now() / 1000) + 300;
    const payload = `${workspace_id}:${actor_id}:${exp}`;
    const sig = createHmac('sha256', sharedToken() || 'dev').update(payload).digest('hex');
    const token = `carina-ex.${payload}.${sig}`;
    res.json({ access_token: token, expires_at: exp, product: 'carina' });
  });

  app.get('/api/keprix/v1/context', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    const purpose = String(req.query.purpose ?? 'agent');
    const workspace_id = String(req.query.workspace_id ?? '').trim() || 'default';
    const raw: Ctx = {
      workspace_id,
      workspace_name: `Workspace ${workspace_id}`,
      actor_id: String(req.query.actor_id ?? 'operator'),
      entitlements: ['aiva.worker'],
      soft_wall_pending_count: 0,
      plan: 'worker',
      product: 'carina',
      password: 'SHOULD_STRIP',
      token: 'SHOULD_STRIP',
    };
    res.json(projectContext(raw, purpose));
  });

  app.post('/api/keprix/v1/events/ack', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    res.json({
      acked: true,
      id: String(req.body?.id ?? ''),
      deduped: Boolean(req.body?.deduped),
    });
  });

  app.get('/api/keprix/v1/soft-wall/pending', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    res.json({
      workspace_id: String(req.query.workspace_id ?? ''),
      pending_count: 0,
      deep_link_base: '/crm/soft-wall',
    });
  });

  app.get('/api/keprix/v1/crm/records/:id', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    res.json({
      id: req.params.id,
      display_name: 'Projected contact',
      email: null,
      projected: true,
    });
  });

  app.post('/api/keprix/v1/approvals/:id/ack', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    res.json({
      approval_id: req.params.id,
      acked: true,
      artifact_ref: req.body?.artifact_ref ?? null,
    });
  });

  app.post('/api/keprix/v1/crm/propose/apply', (req, res) => {
    if (!requireBootstrap(req, res)) return;
    const idem = String(req.headers['idempotency-key'] ?? req.body?.idempotency_key ?? '');
    if (!req.body?.approval_id) {
      res.status(403).json({ error: 'approval evidence required', code: 'soft_wall_required' });
      return;
    }
    if (idem && idempotentApplies.has(idem)) {
      res.json(idempotentApplies.get(idem));
      return;
    }
    const result = {
      applied: true,
      approval_id: String(req.body.approval_id),
      idempotency_key: idem || null,
    };
    if (idem) idempotentApplies.set(idem, result);
    res.json(result);
  });
}
