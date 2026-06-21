import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { config } from '../config/index.js';
import { pool } from '../db.js';
import type { HeartbeatPayload } from '../types.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const heartbeatRouter: IRouter = Router();

function validateHeartbeat(body: unknown): { ok: true; data: HeartbeatPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.instance_id !== 'string' || !/^[a-z0-9_\-]+$/.test(b.instance_id)) {
    return { ok: false, error: 'instance_id is required and must match /^[a-z0-9_\\-]+$/' };
  }
  if (typeof b.name !== 'string' || !b.name.trim() || b.name.length > 80) {
    return { ok: false, error: 'name is required and must be max 80 chars' };
  }
  return { ok: true, data: { instance_id: b.instance_id, name: b.name.trim() } };
}

heartbeatRouter.post('/', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const validated = validateHeartbeat(req.body);
  if (!validated.ok) {
    res.status(400).json({ error: validated.error });
    return;
  }

  const { instance_id, name } = validated.data;
  const accountId = req.scoutAuth?.kind === 'account' ? req.scoutAuth.accountId : null;

  try {
    await pool.query(
      `INSERT INTO carina_instances (id, name, api_key, status, account_id, last_heartbeat)
       VALUES ($1, $2, $3, 'active', $4, NOW())
       ON CONFLICT (id) DO UPDATE
         SET last_heartbeat = NOW(),
             name = EXCLUDED.name,
             account_id = COALESCE(carina_instances.account_id, EXCLUDED.account_id),
             status = CASE
               WHEN carina_instances.status = 'suspended' THEN 'suspended'
               ELSE 'active'
             END`,
      [instance_id, name, config.auth.apiKey, accountId],
    );
    res.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:heartbeat] Upsert failed:', msg);
    res.status(500).json({ error: 'Database error' });
  }
});
