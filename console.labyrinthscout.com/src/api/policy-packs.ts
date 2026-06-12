import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import {
  applyPolicyPack,
  getAppliedPolicyPack,
  listPolicyPacks,
  rollbackPolicyPack,
  type PolicyPackId,
} from '../security/policy-packs.js';
import { broadcastEvent, refreshAndBroadcastStats } from './sse.js';
import type { SecurityEventRow } from '../types.js';

export const policyPacksRouter: IRouter = Router();

const VALID_PACK_IDS = new Set<PolicyPackId>([
  'observe', 'guard', 'restrict', 'quarantine', 'regulated', 'high-trust', 'dev', 'team', 'prod',
]);

policyPacksRouter.get('/', (_req, res) => {
  res.json({ packs: listPolicyPacks() });
});

policyPacksRouter.get('/active', (req: Request, res: Response) => {
  const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : undefined;
  const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id : undefined;
  res.json({ active: getAppliedPolicyPack(sessionId, instanceId) });
});

policyPacksRouter.post('/apply', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const packId = typeof body.pack_id === 'string' && VALID_PACK_IDS.has(body.pack_id as PolicyPackId)
      ? body.pack_id as PolicyPackId
      : null;
    if (!packId) {
      res.status(400).json({ error: 'Valid pack_id is required' });
      return;
    }

    const applied = await applyPolicyPack({
      packId,
      sessionId: typeof body.session_id === 'string' ? body.session_id : undefined,
      instanceId: typeof body.instance_id === 'string' ? body.instance_id : undefined,
      appliedBy: typeof body.applied_by === 'string' ? body.applied_by : 'operator',
    });

    const result = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, session_id, instance_id)
       VALUES ('info', 'scout-api', 'policy_pack_applied', $1, $2, $3, $4)
       RETURNING *`,
      [
        `Policy pack applied: ${packId}`,
        JSON.stringify({ pack_id: packId, previous: applied.previousPackId }),
        applied.sessionId ?? null,
        applied.instanceId ?? null,
      ],
    );

    const inserted = result.rows[0];
    if (inserted) {
      broadcastEvent({
        ...inserted,
        metadata: typeof inserted.metadata === 'object' && inserted.metadata !== null
          ? inserted.metadata as Record<string, unknown>
          : {},
        created_at: new Date(inserted.created_at).toISOString(),
      });
      void refreshAndBroadcastStats();
    }

    res.json(applied);
  } catch (err) {
    console.error('[scout:policy-packs] apply failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

policyPacksRouter.post('/rollback', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const rolled = await rollbackPolicyPack(
      typeof body.session_id === 'string' ? body.session_id : undefined,
      typeof body.instance_id === 'string' ? body.instance_id : undefined,
    );
    res.json({ ok: true, previous: rolled });
  } catch (err) {
    console.error('[scout:policy-packs] rollback failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
