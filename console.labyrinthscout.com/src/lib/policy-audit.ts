import type { Request } from 'express';
import { pool } from '../db.js';
import type { PolicyDecision } from '../security/policy-decisions.js';

export async function logPolicyDecision(
  req: Request | undefined,
  decision: PolicyDecision,
  meta: Record<string, unknown>,
): Promise<void> {
  const instanceId = typeof req?.headers['x-scout-instance-id'] === 'string'
    ? req.headers['x-scout-instance-id']
    : typeof meta.instanceId === 'string'
      ? meta.instanceId
      : 'unknown';

  const sessionId = typeof meta.sessionId === 'string' ? meta.sessionId : null;

  try {
    await pool.query(
      `INSERT INTO security_events
        (instance_id, event_type, severity, source, description, metadata, session_id, created_at)
       VALUES ($1, $2, $3, 'scout-policy', $4, $5, $6, NOW())`,
      [
        instanceId,
        'policy_decision',
        decision.decision === 'block' || decision.decision === 'quarantine_session'
          ? 'critical'
          : decision.decision === 'require_approval'
            ? 'warning'
            : 'info',
        `Policy ${decision.decision}: ${decision.reason}`,
        JSON.stringify({
          decision: decision.decision,
          actionType: decision.actionType,
          riskScore: decision.riskScore,
          shieldMode: decision.shieldMode,
          ip: req?.ip,
          userAgent: req?.headers['user-agent'],
          ...meta,
          ...decision.metadata,
        }),
        sessionId,
      ],
    );
  } catch (err) {
    console.error('[ScoutPolicy] Failed to log policy decision:', err);
  }
}

export async function isSessionBlocked(sessionId: string): Promise<boolean> {
  try {
    const result = await pool.query<{ session_id: string }>(
      'SELECT session_id FROM blocked_sessions WHERE session_id = $1 LIMIT 1',
      [sessionId],
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}
