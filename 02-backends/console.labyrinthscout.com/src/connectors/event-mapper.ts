import type { AlertSeverity, SecurityEvent } from '../alerts/types.js';
import type { ScoutAlert, ScoutFinding, ScoutFindingSeverity, ScoutFindingType } from './types.js';

const EVENT_TYPE_MAP: Record<string, ScoutFindingType> = {
  injection_blocked: 'prompt_injection',
  prompt_injection: 'prompt_injection',
  repeated_injection_blocks: 'prompt_injection',
  honeypot_triggered: 'honeypot_triggered',
  stale_marker_detected: 'honeypot_triggered',
  risk_score_spike: 'anomaly_spike',
  anomaly_detected: 'anomaly_spike',
  kill_switch_activated: 'kill_activated',
  kill_activated: 'kill_activated',
  global_kill_activated: 'kill_activated',
  egress_blocked: 'egress_violation',
  egress_violation: 'egress_violation',
  tool_abuse: 'tool_abuse',
  tool_rate_limit_exceeded: 'tool_abuse',
  trust_attestation_failed: 'trust_attestation_failed',
  trust_verification_failed: 'trust_attestation_failed',
  vulnerability_detected: 'vulnerability',
};

const EVENT_MITRE: Record<string, string[]> = {
  injection_blocked: ['T1059', 'T1566'],
  prompt_injection: ['T1059', 'T1566'],
  repeated_injection_blocks: ['T1059', 'T1566'],
  honeypot_triggered: ['T1567', 'T1071'],
  stale_marker_detected: ['T1567'],
  risk_score_spike: ['T1071'],
  anomaly_detected: ['T1071'],
  kill_switch_activated: ['T1489'],
  kill_activated: ['T1489'],
  egress_blocked: ['T1048'],
  egress_violation: ['T1048'],
  tool_abuse: ['T1059', 'T1204'],
  trust_attestation_failed: ['T1556'],
  trust_verification_failed: ['T1556'],
  vulnerability_detected: ['T1190'],
};

const SEVERITY_TO_FINDING: Record<AlertSeverity, ScoutFindingSeverity> = {
  breach: 'critical',
  critical: 'critical',
  warning: 'high',
  info: 'info',
};

const SEVERITY_RISK_SCORE: Record<AlertSeverity, number> = {
  breach: 95,
  critical: 85,
  warning: 60,
  info: 20,
};

function mapFindingType(eventType: string): ScoutFindingType {
  return EVENT_TYPE_MAP[eventType] ?? 'anomaly_spike';
}

export function mapSecurityEventToFinding(
  event: SecurityEvent,
  accountId: string,
  metadata: Record<string, unknown> = {},
): ScoutFinding {
  const eventType = event.event_type;
  const evidence: ScoutFinding['evidence'] = {};
  if (typeof metadata.prompt === 'string') evidence.prompt = metadata.prompt;
  if (typeof metadata.tool_call === 'string') evidence.toolCall = metadata.tool_call;
  if (typeof metadata.response === 'string') evidence.response = metadata.response;
  if (typeof metadata.user_agent === 'string') evidence.userAgent = metadata.user_agent;
  if (typeof metadata.source_ip === 'string') evidence.sourceIp = metadata.source_ip;

  const remediation =
    typeof metadata.remediation === 'string' ? metadata.remediation : undefined;
  const scoutScore =
    typeof metadata.scout_score === 'number' ? metadata.scout_score : undefined;

  return {
    id: event.id,
    type: mapFindingType(eventType),
    severity: SEVERITY_TO_FINDING[event.severity],
    title: eventType.replace(/_/g, ' '),
    description: event.description,
    agentId: event.instance_id,
    agentName: String(metadata.agent_name ?? event.instance_id),
    sessionId: event.session_id,
    timestamp: event.created_at.toISOString(),
    mitreAttackIds: EVENT_MITRE[eventType] ?? ['T1071'],
    evidence: Object.keys(evidence).length > 0 ? evidence : undefined,
    remediation,
    riskScore:
      typeof metadata.risk_score === 'number'
        ? metadata.risk_score
        : SEVERITY_RISK_SCORE[event.severity],
    scoutScore,
    accountId,
  };
}

export function buildAlertFromFinding(finding: ScoutFinding): ScoutAlert {
  return {
    id: `alert-${finding.id}`,
    findingId: finding.id,
    severity: finding.severity,
    title: finding.title,
    message: finding.description,
    timestamp: finding.timestamp,
    requiresImmediate: finding.severity === 'critical' || finding.severity === 'high',
  };
}

export function buildAlertMessage(finding: ScoutFinding): string {
  return [
    `[${finding.severity.toUpperCase()}] ${finding.title}`,
    finding.description,
    `Agent: ${finding.agentName} (${finding.agentId})`,
    `Session: ${finding.sessionId}`,
    `Risk score: ${finding.riskScore}`,
  ].join('\n');
}
