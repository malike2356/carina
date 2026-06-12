import type { ShieldMode } from '../../security/policy-decisions.js';
import type { SurfaceRestrictionState } from '../../security/attack-surface.js';
import type { JitGrant } from '../../security/jit-privileges.js';

export interface ResponseTerminalSummary {
  generated_at: string;
  risk_score: number;
  risk_tier: string;
  shield_mode: ShieldMode | null;
  session_id: string | null;
  blocked_actions_24h: number;
  suspicious_tools: string[];
  policy_state: {
    shield_mode: ShieldMode | null;
    active_restrictions: SurfaceRestrictionState[];
    active_grants: JitGrant[];
  };
  connected_channels: string[];
  provider_state: string;
  last_unsafe_event: {
    id: string;
    event_type: string;
    description: string;
    created_at: string;
    session_id: string | null;
  } | null;
  recommended_action: string;
  available_actions: Array<{
    id: string;
    label: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

export function buildResponseTerminal(input: {
  riskScore: number;
  shieldMode: ShieldMode | null;
  sessionId: string | null;
  blockedActions24h: number;
  suspiciousTools: string[];
  restrictions: SurfaceRestrictionState[];
  grants: JitGrant[];
  lastUnsafeEvent: ResponseTerminalSummary['last_unsafe_event'];
  connectedChannels?: string[];
  providerState?: string;
  now?: Date;
}): ResponseTerminalSummary {
  const now = input.now ?? new Date();
  const riskTier = input.riskScore >= 75 ? 'critical'
    : input.riskScore >= 50 ? 'elevated'
      : input.riskScore >= 25 ? 'moderate'
        : 'low';

  const actions: ResponseTerminalSummary['available_actions'] = [];

  if (input.riskScore >= 50) {
    actions.push({ id: 'suspend_session', label: 'Suspend session', severity: 'critical' });
  }
  if (input.suspiciousTools.length > 0) {
    actions.push({ id: 'quarantine_tool', label: 'Quarantine suspicious tool', severity: 'critical' });
  }
  if (input.restrictions.length === 0 && input.riskScore >= 40) {
    actions.push({ id: 'narrow_egress', label: 'Narrow egress', severity: 'warning' });
  }
  actions.push({ id: 'require_approval', label: 'Require approvals', severity: 'warning' });
  actions.push({ id: 'export_incident', label: 'Export incident bundle', severity: 'info' });

  let recommended = 'Monitor session; no immediate action required';
  if (input.shieldMode === 'quarantine') {
    recommended = 'Review quarantined session before resuming';
  } else if (input.riskScore >= 75) {
    recommended = 'Suspend session and export incident bundle';
  } else if (input.riskScore >= 50) {
    recommended = 'Move to restrict mode and narrow egress';
  } else if (input.suspiciousTools.length > 0) {
    recommended = 'Quarantine suspicious tools and review recent events';
  }

  return {
    generated_at: now.toISOString(),
    risk_score: input.riskScore,
    risk_tier: riskTier,
    shield_mode: input.shieldMode,
    session_id: input.sessionId,
    blocked_actions_24h: input.blockedActions24h,
    suspicious_tools: input.suspiciousTools,
    policy_state: {
      shield_mode: input.shieldMode,
      active_restrictions: input.restrictions,
      active_grants: input.grants,
    },
    connected_channels: input.connectedChannels ?? [],
    provider_state: input.providerState ?? 'unknown',
    last_unsafe_event: input.lastUnsafeEvent,
    recommended_action: recommended,
    available_actions: actions,
  };
}
