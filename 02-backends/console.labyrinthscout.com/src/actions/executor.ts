import type { PlaybookAction } from './types.js';
import type { SecurityEvent } from '../alerts/types.js';
import { pool } from '../db.js';
import { publishControlMessage } from '../lib/instance-control.js';
import { setShieldMode } from '../security/session-shield.js';
import type { ShieldMode } from '../security/policy-decisions.js';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { captureForensicSnapshot } from '../security/forensic-snapshot.js';

export interface ExecutionResult {
  ok: boolean;
  message: string;
}

export async function executeAutoAction(
  action: PlaybookAction,
  event: SecurityEvent,
): Promise<ExecutionResult> {
  if (action.type === 'steps') {
    return { ok: true, message: 'Manual steps provided; no automatic execution' };
  }

  if (action.type === 'script') {
    return { ok: false, message: 'Script actions must be run manually by the operator' };
  }

  if (action.type !== 'button') {
    return { ok: false, message: 'Action type is not auto-executable' };
  }

  try {
    switch (action.id) {
      case 'terminate-session':
      case 'block-user':
        return await executeTerminateSession(
          event.session_id,
          event.instance_id,
          action.id === 'block-user'
            ? 'Operator action: blocked after review'
            : 'Operator action: unusual activity',
        );

      case 'restrict-session':
        return await executeShieldMode(event.session_id, 'restrict');

      case 'watch-session':
        return await executeShieldMode(event.session_id, 'guard');

      case 'arm-killswitch':
        return await executeArmKillSwitch(event.instance_id);

      case 'disarm-killswitch':
        return await executeDisarmKillSwitch();

      case 'run-session-audit':
        return await executeTriggerAudit(event.session_id, event.instance_id);

      case 'acknowledge-monitor':
        return await executeAcknowledge(event.id);

      case 'manual-revoke-steps':
        return { ok: true, message: 'Manual revoke steps listed in playbook; follow them in order' };

      default:
        return { ok: false, message: `Unknown auto action: ${action.id}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, message: `Execution error: ${message}` };
  }
}

async function executeTerminateSession(
  sessionId: string,
  instanceId: string,
  reason: string,
): Promise<ExecutionResult> {
  if (!sessionId || sessionId === 'system') {
    return { ok: false, message: 'No session ID available for termination' };
  }

  await pool.query(
    `INSERT INTO blocked_sessions (session_id, reason, blocked_by)
     VALUES ($1, $2, 'operator')
     ON CONFLICT (session_id) DO UPDATE
       SET reason = EXCLUDED.reason, blocked_at = NOW()`,
    [sessionId, reason],
  );

  await publishControlMessage({
    action: 'block_session',
    session_id: sessionId,
    instance_id: instanceId || null,
    reason,
    timestamp: new Date().toISOString(),
  });

  return { ok: true, message: `Session ${sessionId} terminated on instance ${instanceId}` };
}

async function executeShieldMode(
  sessionId: string,
  mode: ShieldMode,
): Promise<ExecutionResult> {
  if (!sessionId || sessionId === 'system') {
    return { ok: false, message: 'No session ID available for shield mode change' };
  }

  await setShieldMode(sessionId, mode, 'system', `Find-Act auto action: ${mode}`);
  return { ok: true, message: `Session ${sessionId} moved to ${mode} mode` };
}

async function executeArmKillSwitch(instanceId: string): Promise<ExecutionResult> {
  const reason = `Auto-armed on breach event from ${instanceId || 'unknown'}`;
  const result = await globalKillSwitch.trigger('system', reason);
  return {
    ok: true,
    message: `Global kill switch armed; ${result.agents_stopped} agents stopped`,
  };
}

async function executeDisarmKillSwitch(): Promise<ExecutionResult> {
  await globalKillSwitch.disarm('operator', 'Operator action: breach contained');
  return { ok: true, message: 'Global kill switch disarmed' };
}

async function executeTriggerAudit(
  sessionId: string,
  instanceId: string,
): Promise<ExecutionResult> {
  if (!instanceId) {
    return { ok: false, message: 'No instance ID available for forensic audit' };
  }

  const reason = sessionId && sessionId !== 'system'
    ? `Session audit for ${sessionId}`
    : 'Operator-triggered session audit';

  const snapshot = await captureForensicSnapshot(instanceId, reason);
  return {
    ok: true,
    message: `Forensic audit captured (snapshot ${snapshot.snapshotId}) for session ${sessionId || 'unknown'}`,
  };
}

async function executeAcknowledge(eventId: string): Promise<ExecutionResult> {
  await pool.query(
    `UPDATE security_events
     SET acknowledged = TRUE, acknowledged_at = NOW(), mitigated = TRUE
     WHERE id = $1`,
    [eventId],
  );
  return { ok: true, message: 'Event acknowledged' };
}
