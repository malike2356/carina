import { createHash, randomBytes } from 'crypto';
import { Router, type IRouter, type NextFunction, type Response } from 'express';
import { pool } from '../db.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const sensorRouter: IRouter = Router();

type SensorRequest = RequestWithScoutAuth & {
  sensorAccountId?: string;
  sensorKeyId?: string;
};

async function requireSensorKey(req: SensorRequest, res: Response, next: NextFunction): Promise<void> {
  const raw = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  if (!raw) {
    res.status(401).json({ error: 'Missing sensor key' });
    return;
  }
  const hash = createHash('sha256').update(raw).digest('hex');
  const result = await pool.query<{ account_id: string; id: string }>(
    `SELECT account_id, id FROM sensor_keys WHERE key_hash = $1 AND active = true LIMIT 1`,
    [hash],
  );
  if (!result.rows[0]) {
    res.status(401).json({ error: 'Invalid sensor key' });
    return;
  }
  req.sensorAccountId = result.rows[0].account_id;
  req.sensorKeyId = result.rows[0].id;
  next();
}

function requireAccountId(req: RequestWithScoutAuth, res: Response): string | null {
  if (req.scoutAuth?.kind === 'account') return req.scoutAuth.accountId;
  const fromBody = typeof req.body?.accountId === 'string' ? req.body.accountId.trim() : '';
  const fromQuery = typeof req.query.account_id === 'string' ? req.query.account_id.trim() : '';
  if (req.scoutAuth?.kind === 'operator' && (fromBody || fromQuery)) {
    return fromBody || fromQuery;
  }
  res.status(403).json({ error: 'Account auth required (or operator with account_id)' });
  return null;
}

/** POST /api/sensor/events - ingest batch (sensor Bearer key). */
sensorRouter.post('/events', requireSensorKey, async (req: SensorRequest, res: Response): Promise<void> => {
  const events = (req.body as { events?: unknown })?.events;
  if (!Array.isArray(events) || events.length === 0) {
    res.status(400).json({ error: 'events must be a non-empty array' });
    return;
  }

  const accountId = req.sensorAccountId!;
  const keyId = req.sensorKeyId!;
  const stored: string[] = [];

  for (const event of events as Array<Record<string, unknown>>) {
    const type = typeof event.type === 'string' ? event.type : typeof event.event_type === 'string' ? event.event_type : '';
    if (!type) continue;
    const result = await pool.query<{ id: string }>(
      `INSERT INTO sensor_events (account_id, sensor_key_id, event_type, payload)
       VALUES ($1, $2::uuid, $3, $4)
       RETURNING id`,
      [accountId, keyId, type, JSON.stringify(event)],
    );
    const id = result.rows[0]?.id;
    if (id) stored.push(id);
  }

  await pool.query(
    `UPDATE sensor_keys SET last_seen_at = NOW() WHERE id = $1::uuid`,
    [keyId],
  );

  res.json({ stored: stored.length, ids: stored });
});

sensorRouter.get('/keys', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const result = await pool.query(
    `SELECT id, label, hostname, platform, active, last_seen_at, created_at
     FROM sensor_keys WHERE account_id = $1 ORDER BY created_at DESC`,
    [accountId],
  );
  res.json({
    keys: result.rows.map((r) => ({
      id: r.id,
      label: r.label,
      hostname: r.hostname,
      platform: r.platform,
      active: r.active,
      lastSeenAt: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : null,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  });
});

sensorRouter.post('/keys', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const label =
    typeof req.body?.label === 'string' && req.body.label.trim()
      ? req.body.label.trim()
      : 'Protect sensor';
  const hostname = typeof req.body?.hostname === 'string' ? req.body.hostname.trim() : null;
  const platform =
    typeof req.body?.platform === 'string' && req.body.platform.trim()
      ? req.body.platform.trim()
      : 'linux';
  const rawKey = `sp_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const result = await pool.query<{ id: string }>(
    `INSERT INTO sensor_keys (account_id, key_hash, label, hostname, platform)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [accountId, keyHash, label, hostname, platform],
  );
  res.status(201).json({ id: result.rows[0]!.id, label, hostname, platform, key: rawKey });
});

sensorRouter.delete('/keys/:id', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  await pool.query(
    `UPDATE sensor_keys SET active = false WHERE id = $1::uuid AND account_id = $2`,
    [req.params.id, accountId],
  );
  res.json({ ok: true });
});

sensorRouter.get('/verdicts', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
  const result = await pool.query(
    `SELECT id, app_event_id, verdict, disagreement_reason, created_at
     FROM plane_verdicts
     WHERE account_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [accountId, limit],
  );
  res.json({
    verdicts: result.rows.map((r) => ({
      id: r.id,
      appEventId: r.app_event_id,
      verdict: r.verdict,
      disagreementReason: r.disagreement_reason,
      createdAt: new Date(r.created_at).toISOString(),
    })),
  });
});
