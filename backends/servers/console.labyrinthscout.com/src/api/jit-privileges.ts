import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import {
  createJitGrant,
  listSessionGrants,
  revokeJitGrant,
  type JitGrantScope,
} from '../security/jit-privileges.js';
import { broadcastEvent, refreshAndBroadcastStats } from './sse.js';
import type { SecurityEventRow } from '../types.js';

export const jitPrivilegesRouter: IRouter = Router();

const VALID_SCOPES = new Set<JitGrantScope>(['session', 'action', 'tool', 'channel']);

async function logJitEvent(
  eventType: string,
  description: string,
  sessionId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, session_id)
     VALUES ('info', 'scout-api', $1, $2, $3, $4)
     RETURNING *`,
    [eventType, description, JSON.stringify(metadata), sessionId],
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
}

jitPrivilegesRouter.post('/grants', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    if (typeof body.session_id !== 'string' || typeof body.instance_id !== 'string') {
      res.status(400).json({ error: 'session_id and instance_id are required' });
      return;
    }
    const scope = typeof body.scope === 'string' && VALID_SCOPES.has(body.scope as JitGrantScope)
      ? body.scope as JitGrantScope
      : 'tool';

    const grant = await createJitGrant({
      sessionId: body.session_id,
      instanceId: body.instance_id,
      scope,
      toolName: typeof body.tool_name === 'string' ? body.tool_name : undefined,
      actionType: typeof body.action_type === 'string' ? body.action_type : undefined,
      channel: typeof body.channel === 'string' ? body.channel : undefined,
      durationSeconds: typeof body.duration_seconds === 'number' ? body.duration_seconds : 300,
      grantedBy: typeof body.granted_by === 'string' ? body.granted_by : 'operator',
      reason: typeof body.reason === 'string' ? body.reason.slice(0, 500) : undefined,
    });

    await logJitEvent('jit_grant_created', `JIT grant created for ${body.session_id}`, body.session_id, {
      grant_id: grant.id,
      scope,
      expires_at: grant.expiresAt,
    });

    res.status(201).json(grant);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:jit] create failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

jitPrivilegesRouter.get('/grants/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.params.sessionId === 'string' ? req.params.sessionId : '';
  if (!sessionId) {
    res.status(400).json({ error: 'sessionId is required' });
    return;
  }
  const grants = await listSessionGrants(sessionId);
  res.json({ grants });
});

jitPrivilegesRouter.delete('/grants/:grantId', async (req: Request, res: Response): Promise<void> => {
  const grantId = typeof req.params.grantId === 'string' ? req.params.grantId : '';
  if (!grantId) {
    res.status(400).json({ error: 'grantId is required' });
    return;
  }
  const revoked = await revokeJitGrant(grantId);
  if (!revoked) {
    res.status(404).json({ error: 'Grant not found or already expired' });
    return;
  }
  res.json({ ok: true, grant_id: grantId });
});
