import { Router, type IRouter } from 'express';
import type { Response } from 'express';
import { pool } from '../db.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from '../api/sse.js';
import { verifySessionBlockTwoPlane } from '../planes/enforcement-verifier.js';
import type { SecurityEventRow } from '../types.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const blockSessionRouter: IRouter = Router({ mergeParams: true });

function validateBody(body: unknown): { ok: true; reason: string; instance_id: string | null } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const b = body as Record<string, unknown>;
  if (typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 500) {
    return { ok: false, error: 'reason must be a non-empty string up to 500 chars' };
  }
  const instance_id = typeof b.instance_id === 'string' ? b.instance_id : null;
  return { ok: true, reason: b.reason.trim(), instance_id };
}

blockSessionRouter.post('/:sessionId/block', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId || typeof sessionId !== 'string' || sessionId.length > 256) {
      res.status(400).json({ error: 'Valid session_id is required' });
      return;
    }

    const validated = validateBody(req.body);
    if (!validated.ok) {
      res.status(400).json({ error: validated.error });
      return;
    }

    const { reason, instance_id } = validated;
    const instanceIdParam = instance_id ?? (typeof req.query.instance_id === 'string' ? req.query.instance_id : null);

    await pool.query(
      `INSERT INTO blocked_sessions (session_id, reason, blocked_by)
       VALUES ($1, $2, 'operator')
       ON CONFLICT (session_id) DO UPDATE
         SET reason = EXCLUDED.reason, blocked_at = NOW()`,
      [sessionId, reason],
    );

    const evResult = await pool.query<SecurityEventRow>(
      `INSERT INTO security_events
         (severity, source, event_type, description, metadata, session_id, instance_id)
       VALUES ('critical', 'scout-api', 'session_blocked', $1, $2, $3, $4)
       RETURNING *`,
      [
        `Session blocked by operator: ${reason}`,
        JSON.stringify({ reason, blocked_by: 'operator' }),
        sessionId,
        instanceIdParam,
      ],
    );

    const inserted = evResult.rows[0];
    if (inserted) {
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

    await publishControlMessage({
      action: 'block_session',
      session_id: sessionId,
      instance_id: instanceIdParam,
      reason,
      timestamp: new Date().toISOString(),
    });

    const accountId =
      req.scoutAuth?.kind === 'account'
        ? req.scoutAuth.accountId
        : typeof req.body?.account_id === 'string'
          ? req.body.account_id
          : typeof req.query.account_id === 'string'
            ? req.query.account_id
            : null;

    let twoPlane: { verdict: string; verdictId: string; reason?: string } | null = null;
    if (accountId) {
      twoPlane = await verifySessionBlockTwoPlane({
        accountId,
        sessionId,
        appEventId: inserted?.id ?? null,
        delayMs: 50,
      });
    }

    res.json({
      ok: true,
      session_id: sessionId,
      status: 'blocked',
      two_plane: twoPlane,
      two_plane_note: accountId
        ? undefined
        : 'Pass account_id to enable two-plane verification',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scout:block-session] Failed:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});
