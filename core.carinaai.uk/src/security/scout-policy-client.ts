import { config } from '../config/index.js';
import { reportEvent } from './scout-client.js';
import { appendSecurityAudit } from './security-audit.js';

export type ScoutPolicyDecisionKind =
  | 'allow'
  | 'block'
  | 'require_approval'
  | 'dry_run'
  | 'quarantine_session';

export type ScoutPolicyResult = {
  enforced: boolean;
  source: 'scout' | 'local_fallback' | 'disabled';
  decision?: ScoutPolicyDecisionKind;
  reason?: string;
  code?: string;
  riskScore?: number;
  shieldMode?: string;
};

function scoutPolicyUrl(): string {
  const base = config.labyrinth.url.replace(/\/$/, '');
  return `${base}/api/policy/evaluate`;
}

export async function evaluateScoutToolPolicy(
  toolName: string,
  params: Record<string, unknown>,
  sessionId: string,
): Promise<ScoutPolicyResult> {
  if (process.env.LABYRINTH_ENABLED !== 'true') {
    return { enforced: false, source: 'disabled' };
  }

  if (!config.labyrinth.apiKey) {
    return { enforced: false, source: 'local_fallback', reason: 'LABYRINTH_API_KEY not set' };
  }

  try {
    const res = await fetch(scoutPolicyUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Scout-Key': config.labyrinth.apiKey,
      },
      body: JSON.stringify({
        session_id: sessionId,
        tool_name: toolName,
        params,
        confirmed: params._confirmed === true,
        instance_id: config.labyrinth.instanceId,
      }),
      signal: AbortSignal.timeout(config.labyrinth.judgeTimeoutMs ?? 5000),
    });

    if (!res.ok) {
      return {
        enforced: false,
        source: 'local_fallback',
        reason: `Scout policy evaluate HTTP ${res.status}`,
      };
    }

    const data = await res.json() as {
      decision: ScoutPolicyDecisionKind;
      reason?: string;
      riskScore?: number;
      shieldMode?: string;
    };

    if (data.decision === 'block' || data.decision === 'quarantine_session') {
      appendSecurityAudit({
        category: 'scout_policy',
        action: 'deny',
        detail: data.reason ?? data.decision,
        sessionId,
        toolName,
        metadata: { decision: data.decision, riskScore: data.riskScore },
      });
      return {
        enforced: true,
        source: 'scout',
        decision: data.decision,
        reason: data.reason ?? `Scout policy: ${data.decision}`,
        code: data.decision === 'quarantine_session' ? 'SCOUT_QUARANTINE' : 'SCOUT_POLICY_BLOCK',
        riskScore: data.riskScore,
        shieldMode: data.shieldMode,
      };
    }

    if (data.decision === 'require_approval') {
      return {
        enforced: true,
        source: 'scout',
        decision: data.decision,
        reason: data.reason ?? 'Scout requires operator approval',
        code: 'SCOUT_APPROVAL_REQUIRED',
        riskScore: data.riskScore,
        shieldMode: data.shieldMode,
      };
    }

    return {
      enforced: true,
      source: 'scout',
      decision: data.decision,
      reason: data.reason,
      riskScore: data.riskScore,
      shieldMode: data.shieldMode,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      enforced: false,
      source: 'local_fallback',
      reason: `Scout unreachable: ${detail}`,
    };
  }
}

export async function reportPolicyFallback(toolName: string, sessionId: string, reason: string): Promise<void> {
  appendSecurityAudit({
    category: 'scout_policy',
    action: 'local_fallback',
    detail: reason,
    sessionId,
    toolName,
  });
  if (process.env.LABYRINTH_ENABLED === 'true') {
    await reportEvent({
      severity: 'warning',
      source: 'tool-policy',
      event_type: 'policy_evaluate_fallback',
      description: reason,
      metadata: { tool: toolName, session: sessionId },
      instance_id: config.labyrinth.instanceId,
    });
  }
}
