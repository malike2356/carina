import type { ForensicIncident, RootCauseAnalysis, TimelineEvent } from './types.js';

export function analyzeRootCause(
  incident: ForensicIncident,
  timeline: TimelineEvent[],
): RootCauseAnalysis {
  const securityEvents = timeline.filter((e) => e.type === 'security_event');
  const suspicious = timeline.filter((e) => e.suspicious);
  const first = timeline[0];
  const last = timeline[timeline.length - 1];

  const attackPath: string[] = [];
  if (securityEvents.some((e) => /injection|prompt/i.test(e.description))) {
    attackPath.push('Prompt injection attempt detected in user input path');
  }
  if (securityEvents.some((e) => /egress|exfil|sequence/i.test(e.description))) {
    attackPath.push('Tool sequence or egress control triggered during outbound activity');
  }
  if (securityEvents.some((e) => e.details.category === 'tool_rbac')) {
    attackPath.push('RBAC denied elevated tool access for current role');
  }
  if (securityEvents.some((e) => e.details.category === 'kill_switch')) {
    attackPath.push('Kill switch containment activated by Scout or local policy');
  }
  if (attackPath.length === 0 && suspicious.length > 0) {
    attackPath.push(suspicious[0]!.description);
  }
  if (attackPath.length === 0) {
    attackPath.push(`Incident ${incident.title} recorded from ${incident.triggerEventTypes?.join(', ') || 'manual trigger'}`);
  }

  const impact: string[] = [];
  if (incident.sessionId) impact.push(`Session ${incident.sessionId} affected`);
  if (securityEvents.some((e) => e.severity === 'critical')) {
    impact.push('Critical security controls fired during the incident window');
  }
  if (timeline.some((e) => (e.details.toolsUsed as string[] | undefined)?.length)) {
    impact.push('Tool activity observed during incident timeline');
  }
  if (impact.length === 0) impact.push('Impact limited to monitored security telemetry');

  const recommendations: string[] = [];
  if (attackPath.some((step) => step.includes('injection'))) {
    recommendations.push('Review prompt guard thresholds and blocked pattern coverage');
  }
  if (attackPath.some((step) => step.includes('egress') || step.includes('exfil'))) {
    recommendations.push('Tighten egress allowlist and enable tool sequence guard alerts');
  }
  if (attackPath.some((step) => step.includes('RBAC'))) {
    recommendations.push('Audit role assignments and dangerous tool grants');
  }
  recommendations.push('Retain forensic snapshot and verify chain of custody before closure');

  const classification = incident.classification
    ?? (incident.severity === 'critical' ? 'security-incident' : 'security-event');

  return {
    attackPath,
    impact,
    durationMs: first && last ? last.timestamp - first.timestamp : null,
    recommendations,
    classification,
  };
}
