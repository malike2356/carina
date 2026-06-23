import { pool } from '../db.js';
import { handleRiskTransition, type RiskTrigger } from './risk-transitions.js';
import { applySurfaceRestriction } from './attack-surface.js';
import { setShieldMode } from './session-shield.js';
import { publishControlMessage } from '../lib/instance-control.js';

export type RemediationCase =
  | 'suspicious_egress'
  | 'repeated_injection'
  | 'unknown_plugin'
  | 'risky_burst'
  | 'stale_marker';

export interface RemediationRule {
  id: string;
  case: RemediationCase;
  enabled: boolean;
  autoApply: boolean;
  description: string;
}

export interface RemediationResult {
  applied: boolean;
  case: RemediationCase;
  actions: string[];
  reversible: boolean;
  eventId?: string;
}

export const DEFAULT_REMEDIATION_RULES: RemediationRule[] = [
  { id: 'egress-block', case: 'suspicious_egress', enabled: true, autoApply: true, description: 'Block suspicious outbound domain' },
  { id: 'injection-quarantine', case: 'repeated_injection', enabled: true, autoApply: true, description: 'Quarantine session on repeated injection' },
  { id: 'unknown-plugin', case: 'unknown_plugin', enabled: true, autoApply: true, description: 'Disable unknown plugin/payload' },
  { id: 'risky-burst', case: 'risky_burst', enabled: true, autoApply: true, description: 'Move to restrict mode on risky tool burst' },
  { id: 'stale-marker', case: 'stale_marker', enabled: true, autoApply: true, description: 'Invalidate context on stale marker' },
];

let rules = [...DEFAULT_REMEDIATION_RULES];

export function getRemediationRules(): RemediationRule[] {
  return [...rules];
}

export function setRemediationRules(newRules: RemediationRule[]): void {
  rules = newRules;
}

export function resetRemediationRules(): void {
  rules = [...DEFAULT_REMEDIATION_RULES];
}

export interface RemediationLogEntry {
  id: string;
  action: string;
  target: string;
  result: 'success' | 'failed';
  instance_id: string | null;
  created_at: string;
  case?: string;
  actions?: string[];
}

export async function listRecentRemediationLog(limit = 80): Promise<RemediationLogEntry[]> {
  const result = await pool.query<{
    id: string;
    event_type: string;
    description: string;
    session_id: string | null;
    instance_id: string | null;
    metadata: Record<string, unknown> | string | null;
    created_at: Date;
  }>(
    `SELECT id, event_type, description, session_id, instance_id, metadata, created_at
     FROM security_events
     WHERE source = 'auto-remediation'
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => {
    const meta = typeof row.metadata === 'object' && row.metadata !== null
      ? row.metadata as Record<string, unknown>
      : {};
    const caseId = typeof meta.case === 'string'
      ? meta.case
      : row.event_type.replace(/^auto_remediation_/, '');
    const actions = Array.isArray(meta.actions)
      ? meta.actions.filter((item): item is string => typeof item === 'string')
      : [];
    const action = actions[0] ?? caseId ?? row.event_type;

    return {
      id: row.id,
      action,
      target: row.session_id ?? '-',
      result: 'success',
      instance_id: row.instance_id,
      created_at: new Date(row.created_at).toISOString(),
      case: caseId,
      actions,
    };
  });
}

async function logRemediation(
  caseId: RemediationCase,
  actions: string[],
  sessionId: string,
  instanceId: string,
  metadata: Record<string, unknown>,
): Promise<string | undefined> {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO security_events
       (severity, source, event_type, description, metadata, session_id, instance_id)
     VALUES ('warning', 'auto-remediation', $1, $2, $3, $4, $5)
     RETURNING id`,
    [
      `auto_remediation_${caseId}`,
      `Auto-remediation applied for ${caseId}`,
      JSON.stringify({ case: caseId, actions, ...metadata }),
      sessionId,
      instanceId,
    ],
  );
  return result.rows[0]?.id;
}

export async function applyRemediation(input: {
  case: RemediationCase;
  sessionId: string;
  instanceId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<RemediationResult> {
  const rule = rules.find((r) => r.case === input.case && r.enabled);
  if (!rule) {
    return { applied: false, case: input.case, actions: ['escalate_to_operator'], reversible: false };
  }

  if (!rule.autoApply) {
    return {
      applied: false,
      case: input.case,
      actions: [`recommend_${input.case}`],
      reversible: true,
    };
  }

  const actions: string[] = [];

  switch (input.case) {
    case 'suspicious_egress':
      await applySurfaceRestriction({
        instanceId: input.instanceId,
        sessionId: input.sessionId,
        restriction: 'external_http',
        reason: input.reason,
        appliedBy: 'auto-remediation',
        durationSeconds: 3600,
      });
      actions.push('restrict_external_http');
      break;

    case 'repeated_injection':
      await setShieldMode(input.sessionId, 'quarantine', 'auto-remediation', input.reason);
      actions.push('quarantine_session');
      break;

    case 'unknown_plugin':
      await applySurfaceRestriction({
        instanceId: input.instanceId,
        restriction: 'plugin',
        target: typeof input.metadata?.plugin_id === 'string' ? input.metadata.plugin_id : undefined,
        reason: input.reason,
        appliedBy: 'auto-remediation',
      });
      actions.push('disable_plugin');
      break;

    case 'risky_burst':
      await handleRiskTransition({
        trigger: 'risky_chain',
        sessionId: input.sessionId,
        instanceId: input.instanceId,
        reason: input.reason,
      });
      actions.push('shield_mode_restrict');
      break;

    case 'stale_marker':
      await publishControlMessage({
        action: 'invalidate_context',
        session_id: input.sessionId,
        instance_id: input.instanceId,
        reason: input.reason,
        timestamp: new Date().toISOString(),
      });
      actions.push('invalidate_context_buffer');
      break;
  }

  const eventId = await logRemediation(
    input.case,
    actions,
    input.sessionId,
    input.instanceId,
    input.metadata ?? {},
  ).catch(() => undefined);

  return {
    applied: true,
    case: input.case,
    actions,
    reversible: true,
    eventId,
  };
}

export async function rollbackRemediation(input: {
  case: RemediationCase;
  sessionId: string;
  instanceId: string;
}): Promise<{ ok: boolean; actions: string[] }> {
  const actions: string[] = [];

  switch (input.case) {
    case 'repeated_injection':
    case 'risky_burst':
      await setShieldMode(input.sessionId, 'observe', 'operator-rollback', 'remediation rolled back');
      actions.push('shield_mode_observe');
      break;
    case 'suspicious_egress':
      actions.push('release_external_http_restriction');
      break;
    default:
      actions.push('manual_review_required');
  }

  return { ok: true, actions };
}

export function caseToRiskTrigger(caseId: RemediationCase): RiskTrigger | null {
  const map: Partial<Record<RemediationCase, RiskTrigger>> = {
    repeated_injection: 'repeated_injection',
    suspicious_egress: 'suspicious_egress',
    risky_burst: 'risky_chain',
    unknown_plugin: 'unknown_tool',
  };
  return map[caseId] ?? null;
}
