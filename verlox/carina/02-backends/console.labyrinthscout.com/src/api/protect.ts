import { createHash, randomBytes } from 'crypto';
import { Router, type IRouter, type Response } from 'express';
import { pool } from '../db.js';
import { getFailClosedMode, resolveUnreachableDecision } from '../lib/fail-closed.js';
import {
  evaluateSoftWall,
  type SoftWallActionClass,
  type SoftWallRiskTier,
} from '../security/soft-wall.js';
import { recordProtectAuditEvent } from '../protect/protect-audit.js';
import type { RequestWithScoutAuth } from '../types/request.js';

export const protectRouter: IRouter = Router();

const CONTAIN_ACTIONS = new Set<SoftWallActionClass>([
  'protect.isolate_network',
  'protect.revoke_session',
  'protect.quarantine_hash',
  'protect.block_path',
  'protect.disable_maintenance',
]);

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

/** POST /api/protect/sensors/register - create sensor credential for Protect agent. */
protectRouter.post('/sensors/register', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const label =
    typeof req.body?.label === 'string' && req.body.label.trim()
      ? req.body.label.trim()
      : 'Protect endpoint';
  const hostname = typeof req.body?.hostname === 'string' ? req.body.hostname.trim() : null;
  const platform =
    typeof req.body?.platform === 'string' && req.body.platform.trim()
      ? req.body.platform.trim()
      : 'linux';
  const rawKey = `sp_${randomBytes(32).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const result = await pool.query<{ id: string }>(
    `INSERT INTO sensor_keys (account_id, key_hash, label, hostname, platform, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id`,
    [accountId, keyHash, label, hostname, platform],
  );
  res.status(201).json({
    sensorId: result.rows[0]!.id,
    label,
    hostname,
    platform,
    key: rawKey,
    auth: 'Authorization: Bearer <key>',
  });
});

/** POST /api/protect/sensors/:id/heartbeat - durable last_seen (account auth). */
protectRouter.post('/sensors/:id/heartbeat', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const result = await pool.query(
    `UPDATE sensor_keys SET last_seen_at = NOW()
     WHERE id = $1::uuid AND account_id = $2 AND active = true
     RETURNING id, last_seen_at`,
    [req.params.id, accountId],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Sensor not found for tenant' });
    return;
  }
  res.json({
    ok: true,
    sensorId: result.rows[0].id,
    lastSeenAt: new Date(result.rows[0].last_seen_at).toISOString(),
  });
});

/** POST /api/protect/telemetry/ack - acknowledge processed event ids (tenant scoped). */
protectRouter.post('/telemetry/ack', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const ids = Array.isArray(req.body?.eventIds) ? req.body.eventIds.filter((x: unknown) => typeof x === 'string') : [];
  if (ids.length === 0) {
    res.status(400).json({ error: 'eventIds array required' });
    return;
  }
  const result = await pool.query(
    `SELECT COUNT(*)::int AS n FROM sensor_events
     WHERE account_id = $1 AND id = ANY($2::uuid[])`,
    [accountId, ids],
  );
  res.json({ ok: true, matched: result.rows[0]?.n ?? 0, acked: ids.length });
});

/** GET /api/protect/policy - query Soft Wall + fail-closed for an action class. */
protectRouter.get('/policy', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const actionClass =
    typeof req.query.actionClass === 'string' ? req.query.actionClass : 'protect.isolate_network';
  const fail = await getFailClosedMode(accountId, actionClass);
  res.json({
    accountId,
    actionClass,
    failClosed: fail,
    unreachableResolved: resolveUnreachableDecision(fail.unreachableAction, fail.mode),
    softWall: {
      criticalRequiresApproval: true,
      breakGlassAllowed: true,
    },
  });
});

/** POST /api/protect/contain - Soft Wall gated containment; durable command row. */
protectRouter.post('/contain', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;

  const actionClass = req.body?.actionClass as SoftWallActionClass;
  if (!CONTAIN_ACTIONS.has(actionClass)) {
    res.status(400).json({
      error: `actionClass must be one of: ${[...CONTAIN_ACTIONS].join(', ')}`,
    });
    return;
  }

  const targetResource =
    typeof req.body?.targetResource === 'string' && req.body.targetResource.trim()
      ? req.body.targetResource.trim()
      : '';
  if (!targetResource) {
    res.status(400).json({ error: 'targetResource is required' });
    return;
  }

  const sensorKeyId =
    typeof req.body?.sensorId === 'string' && req.body.sensorId.trim()
      ? req.body.sensorId.trim()
      : null;
  if (sensorKeyId) {
    const owned = await pool.query(
      `SELECT id FROM sensor_keys WHERE id = $1::uuid AND account_id = $2 AND active = true`,
      [sensorKeyId, accountId],
    );
    if (!owned.rows[0]) {
      res.status(404).json({ error: 'sensorId not found for tenant' });
      return;
    }
  }

  const riskTier: SoftWallRiskTier =
    req.body?.riskTier === 'high' || req.body?.riskTier === 'medium' || req.body?.riskTier === 'low'
      ? req.body.riskTier
      : 'critical';

  const softWall = await evaluateSoftWall({
    actor: typeof req.body?.actor === 'string' ? req.body.actor : 'operator',
    actionClass,
    targetResource,
    riskTier,
    tenantId: accountId,
    policyPack: typeof req.body?.policyPack === 'string' ? req.body.policyPack : undefined,
    sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
    instanceId: typeof req.body?.instanceId === 'string' ? req.body.instanceId : undefined,
    breakGlass: req.body?.breakGlass === true,
    confirmed: req.body?.confirmed === true,
    cachedApprovalId: typeof req.body?.approvalId === 'string' ? req.body.approvalId : undefined,
  });

  if (softWall.decision === 'require_approval') {
    await recordProtectAuditEvent({
      eventType: 'soft_wall_decision',
      severity: 'critical',
      description: `Soft Wall require_approval for ${actionClass} on ${targetResource}`,
      accountId,
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
      metadata: {
        decision: softWall.decision,
        action_class: actionClass,
        approval_request_id: softWall.approvalRequestId,
        soft_wall_id: softWall.auditEventId,
      },
    });
    res.status(428).json({
      decision: softWall.decision,
      reason: softWall.reason,
      approvalRequestId: softWall.approvalRequestId,
      approvalTtlSeconds: softWall.approvalTtlSeconds,
      auditEventId: softWall.auditEventId,
    });
    return;
  }

  if (softWall.decision === 'deny' || softWall.decision === 'quarantine') {
    res.status(403).json({
      decision: softWall.decision,
      reason: softWall.reason,
      auditEventId: softWall.auditEventId,
    });
    return;
  }

  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO protect_control_commands (
       account_id, sensor_key_id, command_type, payload, status, soft_wall_id, approval_id, expires_at
     ) VALUES (
       $1, $2::uuid, $3, $4, 'pending', $5, $6::uuid, NOW() + interval '1 hour'
     ) RETURNING id`,
    [
      accountId,
      sensorKeyId,
      actionClass,
      JSON.stringify({ targetResource, riskTier, actor: req.body?.actor ?? 'operator' }),
      softWall.auditEventId ?? null,
      softWall.approvalRequestId ?? (typeof req.body?.approvalId === 'string' ? req.body.approvalId : null),
    ],
  );

  const audit = await recordProtectAuditEvent({
    eventType: 'protect_contain',
    severity: 'critical',
    description: `Protect contain ${actionClass} queued for ${targetResource}`,
    accountId,
    sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
    instanceId: typeof req.body?.instanceId === 'string' ? req.body.instanceId : undefined,
    metadata: {
      decision: softWall.decision,
      action_class: actionClass,
      command_id: inserted.rows[0]!.id,
      soft_wall_id: softWall.auditEventId,
      break_glass: req.body?.breakGlass === true,
    },
  });

  res.status(202).json({
    decision: softWall.decision,
    commandId: inserted.rows[0]!.id,
    status: 'pending',
    durable: true,
    reason: softWall.reason,
    auditEventId: softWall.auditEventId,
    securityEventId: audit?.id,
  });
});

/** GET /api/protect/commands/pending - sensors poll durable commands for tenant. */
protectRouter.get('/commands/pending', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const sensorId = typeof req.query.sensorId === 'string' ? req.query.sensorId : null;
  const result = await pool.query(
    `SELECT id, sensor_key_id, command_type, payload, status, soft_wall_id, created_at, expires_at
     FROM protect_control_commands
     WHERE account_id = $1
       AND status = 'pending'
       AND (expires_at IS NULL OR expires_at > NOW())
       AND ($2::uuid IS NULL OR sensor_key_id = $2::uuid OR sensor_key_id IS NULL)
     ORDER BY created_at ASC
     LIMIT 50`,
    [accountId, sensorId],
  );
  res.json({
    commands: result.rows.map((r) => ({
      id: r.id,
      sensorId: r.sensor_key_id,
      commandType: r.command_type,
      payload: r.payload,
      status: r.status,
      softWallId: r.soft_wall_id,
      createdAt: new Date(r.created_at).toISOString(),
      expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    })),
  });
});

/** POST /api/protect/commands/:id/ack - mark durable command applied/failed. */
protectRouter.post('/commands/:id/ack', async (req: RequestWithScoutAuth, res: Response): Promise<void> => {
  const accountId = requireAccountId(req, res);
  if (!accountId) return;
  const status = req.body?.status === 'failed' ? 'failed' : req.body?.status === 'acked' ? 'acked' : 'applied';
  const result = await pool.query(
    `UPDATE protect_control_commands
     SET status = $3, updated_at = NOW()
     WHERE id = $1::uuid AND account_id = $2 AND status = 'pending'
     RETURNING id, status`,
    [req.params.id, accountId, status],
  );
  if (!result.rows[0]) {
    res.status(404).json({ error: 'Pending command not found for tenant' });
    return;
  }
  res.json({ ok: true, id: result.rows[0].id, status: result.rows[0].status });
});
