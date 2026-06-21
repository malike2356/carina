import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { buildResponseTerminal } from '../dashboard/widgets/response-terminal.js';
import { getShieldMode, setShieldMode } from '../security/session-shield.js';
import { listSurfaceRestrictions, applySurfaceRestriction } from '../security/attack-surface.js';
import { listSessionGrants } from '../security/jit-privileges.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { broadcastEvent, refreshAndBroadcastStats } from './sse.js';
import type { SecurityEventRow, Severity } from '../types.js';

export const responseTerminalRouter: IRouter = Router();

async function logOperatorAction(
  action: string,
  description: string,
  metadata: Record<string, unknown>,
  sessionId?: string,
  instanceId?: string,
): Promise<void> {
  const result = await pool.query<SecurityEventRow>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, session_id, instance_id)
     VALUES ('warning', 'scout-operator', $1, $2, $3, $4, $5)
     RETURNING *`,
    [action, description, JSON.stringify(metadata), sessionId ?? null, instanceId ?? null],
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

responseTerminalRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;
    const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id : 'default';

    const eventsResult = await pool.query<{
      id: string;
      event_type: string;
      description: string;
      severity: Severity;
      session_id: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
    }>(
      `SELECT id, event_type, description, severity, session_id, metadata, created_at
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 200`,
    );

    const rows = eventsResult.rows;
    const blockedCount = rows.filter((r) =>
      /blocked|quarantine|policy_decision|injection/.test(r.event_type),
    ).length;

    const toolCounts = new Map<string, number>();
    for (const row of rows) {
      const meta = typeof row.metadata === 'object' && row.metadata !== null
        ? row.metadata as Record<string, unknown>
        : {};
      const tool = typeof meta.tool === 'string' ? meta.tool : null;
      if (tool && (row.severity === 'critical' || row.severity === 'warning')) {
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
      }
    }
    const suspiciousTools = [...toolCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([tool]) => tool);

    const unsafeEvents = rows.filter((r) =>
      r.severity === 'critical' || r.severity === 'breach',
    );
    const lastUnsafe = unsafeEvents[0] ?? null;

    const shield = sessionId ? await getShieldMode(sessionId) : null;
    const restrictions = await listSurfaceRestrictions(instanceId, sessionId ?? undefined);
    const grants = sessionId ? await listSessionGrants(sessionId) : [];

    const riskScore = Math.min(100, blockedCount * 5 + suspiciousTools.length * 10
      + (shield?.mode === 'quarantine' ? 30 : shield?.mode === 'restrict' ? 20 : 0));

    const terminal = buildResponseTerminal({
      riskScore,
      shieldMode: shield?.mode ?? null,
      sessionId,
      blockedActions24h: blockedCount,
      suspiciousTools,
      restrictions,
      grants,
      lastUnsafeEvent: lastUnsafe
        ? {
          id: lastUnsafe.id,
          event_type: lastUnsafe.event_type,
          description: lastUnsafe.description,
          created_at: new Date(lastUnsafe.created_at).toISOString(),
          session_id: lastUnsafe.session_id,
        }
        : null,
    });

    res.json(terminal);
  } catch (err) {
    console.error('[scout:response-terminal] GET failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

responseTerminalRouter.post('/actions/:actionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const actionId = typeof req.params.actionId === 'string' ? req.params.actionId : '';
    const body = req.body as Record<string, unknown>;
    const sessionId = typeof body.session_id === 'string' ? body.session_id : undefined;
    const instanceId = typeof body.instance_id === 'string' ? body.instance_id : 'default';
    const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : 'operator action';

    switch (actionId) {
      case 'suspend_session':
        if (!sessionId) {
          res.status(400).json({ error: 'session_id required' });
          return;
        }
        await setShieldMode(sessionId, 'quarantine', 'operator', reason);
        await publishControlMessage({
          action: 'block_session',
          session_id: sessionId,
          instance_id: instanceId,
          reason,
          timestamp: new Date().toISOString(),
        });
        await logOperatorAction('operator_suspend_session', `Session suspended: ${reason}`, { actionId }, sessionId, instanceId);
        break;

      case 'require_approval':
        if (!sessionId) {
          res.status(400).json({ error: 'session_id required' });
          return;
        }
        await setShieldMode(sessionId, 'guard', 'operator', reason);
        await logOperatorAction('operator_require_approval', `Approvals required: ${reason}`, { actionId }, sessionId, instanceId);
        break;

      case 'narrow_egress':
        await applySurfaceRestriction({
          instanceId,
          sessionId,
          restriction: 'external_http',
          reason,
          appliedBy: 'operator',
          durationSeconds: 3600,
        });
        await logOperatorAction('operator_narrow_egress', `Egress narrowed: ${reason}`, { actionId }, sessionId, instanceId);
        break;

      case 'export_incident':
        await logOperatorAction('operator_export_incident', 'Incident export requested', {
          actionId,
          session_id: sessionId,
          instance_id: instanceId,
        }, sessionId, instanceId);
        break;

      default:
        res.status(400).json({ error: `Unknown action: ${actionId}` });
        return;
    }

    res.json({ ok: true, action: actionId });
  } catch (err) {
    console.error('[scout:response-terminal] action failed:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
