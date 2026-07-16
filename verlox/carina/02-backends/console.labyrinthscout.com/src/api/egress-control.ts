import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { getRedis } from '../redis.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import type { SecurityEventRow } from '../types.js';

export const egressControlRouter: IRouter = Router();

const DOMAIN_RE = /^[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]{0,61}[a-z0-9])?)+$/i;

const blocklistKey = (instanceId: string): string => `scout:egress:blocklist:${instanceId}`;

export function sanitiseDomain(raw: string): { ok: true; domain: string } | { ok: false; error: string } {
  let d = raw.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/[/?#:].*/, '');
  if (d.startsWith('*.')) d = d.slice(2);
  if (!d || !DOMAIN_RE.test(d) || d.length > 253) {
    return { ok: false, error: 'Invalid domain. Provide a hostname without protocol, e.g. evil.com' };
  }
  return { ok: true, domain: d };
}

function validateInstanceId(id: unknown): id is string {
  return typeof id === 'string' && /^[a-z0-9_-]+$/.test(id) && id.length <= 64;
}

async function insertEgressEvent(
  severity: 'info' | 'warning',
  eventType: string,
  description: string,
  instanceId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, instance_id)
     VALUES ($1, 'scout-api', $2, $3, $4, $5)
     RETURNING *`,
    [severity, eventType, description, JSON.stringify(metadata), instanceId],
  );
  const inserted = result.rows[0];
  if (!inserted) return;
  const event: SecurityEventRow = {
    ...inserted,
    metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
      ? (inserted.metadata as Record<string, unknown>)
      : {},
    created_at: new Date(inserted.created_at).toISOString(),
  };
  broadcastEvent(event);
  void refreshAndBroadcastStats();
}

async function handlePostBlock(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const domainRaw = typeof body.domain === 'string' ? body.domain : '';
    const parsed = sanitiseDomain(domainRaw);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if (!validateInstanceId(body.instance_id)) {
      res.status(400).json({ error: 'Valid instance_id is required' });
      return;
    }
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason || reason.length > 500) {
      res.status(400).json({ error: 'reason must be a non-empty string up to 500 chars' });
      return;
    }

    const { domain } = parsed;
    const instanceId = body.instance_id;
    const redis = getRedis();
    if (!redis) {
      res.status(503).json({ error: 'Redis unavailable' });
      return;
    }

    await redis.sadd(blocklistKey(instanceId), domain);
    await publishControlMessage({
      action: 'block_egress',
      domain,
      instance_id: instanceId,
      reason,
      timestamp: new Date().toISOString(),
    });
    await insertEgressEvent(
      'warning',
      'egress_domain_blocked',
      `Operator blocked domain: ${domain}`,
      instanceId,
      { domain, reason },
    );

    res.json({ ok: true, domain, instance_id: instanceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:egress] POST block failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleGetBlocklist(req: Request, res: Response): Promise<void> {
  try {
    const instanceId = req.query.instance_id;
    if (!validateInstanceId(instanceId)) {
      res.json({ blocked: [] });
      return;
    }

    const redis = getRedis();
    if (!redis) {
      res.json({ blocked: [] });
      return;
    }

    const members = await redis.smembers(blocklistKey(instanceId));
    const blocked = (members ?? []).slice().sort();
    res.json({ blocked });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:egress] GET blocklist failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDeleteUnblock(req: Request, res: Response): Promise<void> {
  try {
    const parsed = sanitiseDomain(String(req.params['domain'] ?? ''));
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const instanceId = req.query.instance_id;
    if (!validateInstanceId(instanceId)) {
      res.status(400).json({ error: 'Valid instance_id query param is required' });
      return;
    }

    const { domain } = parsed;
    const redis = getRedis();
    if (redis) {
      await redis.srem(blocklistKey(instanceId), domain);
    }

    await publishControlMessage({
      action: 'unblock_egress',
      domain,
      instance_id: instanceId,
      timestamp: new Date().toISOString(),
    });
    await insertEgressEvent(
      'info',
      'egress_domain_unblocked',
      `Operator unblocked domain: ${domain}`,
      instanceId,
      { domain },
    );

    res.json({ ok: true, domain, instance_id: instanceId, status: 'unblocked' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:egress] DELETE unblock failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
}

egressControlRouter.post('/block', handlePostBlock);
egressControlRouter.get('/blocklist', handleGetBlocklist);
egressControlRouter.delete('/block/:domain', handleDeleteUnblock);
