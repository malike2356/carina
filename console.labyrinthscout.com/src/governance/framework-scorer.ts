import type { RegulatoryClassification } from './regulatory-classification.js';

export interface FrameworkScorerInput {
  audit_log_active_7d: boolean;
  audit_log_active_24h: boolean;
  kill_switch_armed: boolean;
  last_attestation_within_60d: boolean;
  erc8004_live: boolean;
  heartbeat_within_24h: boolean;
  heartbeat_within_1h: boolean;
  alert_channels_configured: boolean;
  retention_configured: boolean;
  policy_pack_not_observe: boolean;
  risk_score_documented: boolean;
  incidents_table_has_rows: boolean;
  approval_workflow_active: boolean;
}

export interface FrameworkScores {
  eu_ai_act_readiness: number;
  gdpr_readiness: number;
  soc2_readiness: number;
  iso42001_readiness: number;
}

export interface GovernanceActionItem {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  label: string;
  framework: string;
  article: string;
}

export interface FrameworkScoreDetail extends FrameworkScores {
  governance_score: number;
  governance_label: 'Compliant' | 'At Risk' | 'Non-Compliant';
  action_items: GovernanceActionItem[];
  primary_gaps: Record<keyof FrameworkScores, string | null>;
}

function pct(met: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((met / total) * 100);
}

function governanceLabel(score: number): FrameworkScoreDetail['governance_label'] {
  if (score >= 80) return 'Compliant';
  if (score >= 55) return 'At Risk';
  return 'Non-Compliant';
}

function frameworkStatus(score: number): string {
  if (score >= 80) return 'Compliant';
  if (score >= 55) return 'At Risk';
  return 'Review Required';
}

export function scoreFrameworks(
  input: FrameworkScorerInput,
  regulatory: RegulatoryClassification,
): FrameworkScoreDetail {
  const euControls = [
    { key: 'audit_log_active', met: input.audit_log_active_7d, article: 'Article 12', label: 'Enable continuous audit logging', critical: true },
    { key: 'human_oversight', met: input.kill_switch_armed || input.approval_workflow_active, article: 'Article 14', label: 'Configure human oversight (kill switch or approval workflow)', critical: true },
    { key: 'risk_documented', met: input.last_attestation_within_60d, article: 'Article 9', label: 'Submit on-chain risk attestation within 60 days', critical: false },
    { key: 'agent_identity', met: input.erc8004_live, article: 'Article 13', label: 'Register ERC-8004 agent identity on-chain', critical: false },
    { key: 'monitoring_active', met: input.heartbeat_within_24h, article: 'Article 9', label: 'Ensure at least one agent heartbeat within 24 hours', critical: false },
    { key: 'incident_response', met: input.alert_channels_configured, article: 'Article 14', label: 'Configure alert channels for incident response', critical: true },
  ];

  const euMet = euControls.filter((c) => c.met).length;
  const eu_ai_act_readiness = pct(euMet, euControls.length);

  const gdprMet = 2 + (input.retention_configured ? 2 : 0);
  const gdpr_readiness = pct(gdprMet, 4);

  const soc2Controls = [
    input.heartbeat_within_1h,
    true,
    input.audit_log_active_24h,
    input.incidents_table_has_rows,
    input.alert_channels_configured,
  ];
  const soc2_readiness = pct(soc2Controls.filter(Boolean).length, soc2Controls.length);

  const isoControls = [
    input.policy_pack_not_observe,
    input.risk_score_documented,
    input.kill_switch_armed || input.approval_workflow_active,
    input.audit_log_active_7d,
    input.erc8004_live,
  ];
  const iso42001_readiness = pct(isoControls.filter(Boolean).length, isoControls.length);

  const governance_score = Math.round(
    eu_ai_act_readiness * 0.35
    + gdpr_readiness * 0.25
    + soc2_readiness * 0.20
    + iso42001_readiness * 0.20,
  );

  const action_items: GovernanceActionItem[] = [];
  for (const control of euControls.filter((c) => !c.met)) {
    action_items.push({
      id: `eu-${control.key}`,
      priority: control.critical ? 'critical' : 'high',
      label: control.label,
      framework: 'EU AI Act',
      article: control.article,
    });
  }

  for (const gap of regulatory.eu_ai_act.gaps.slice(0, 3)) {
    action_items.push({
      id: `gap-${action_items.length}`,
      priority: 'medium',
      label: gap,
      framework: 'EU AI Act',
      article: regulatory.eu_ai_act.article_refs[0] ?? 'Article 52',
    });
  }

  if (!input.retention_configured) {
    action_items.push({
      id: 'gdpr-retention',
      priority: 'medium',
      label: 'Document and enforce data retention policies',
      framework: 'GDPR',
      article: 'Article 5',
    });
  }

  const deduped = action_items.filter((item, idx, arr) =>
    arr.findIndex((other) => other.label === item.label) === idx,
  ).slice(0, 6);

  const primary_gaps: FrameworkScoreDetail['primary_gaps'] = {
    eu_ai_act_readiness: euControls.find((c) => !c.met)?.label ?? null,
    gdpr_readiness: input.retention_configured ? null : 'Data retention policy not evidenced',
    soc2_readiness: !input.heartbeat_within_1h
      ? 'Continuous monitoring heartbeat older than 1 hour'
      : !input.audit_log_active_24h
        ? 'No audit events in the last 24 hours'
        : null,
    iso42001_readiness: !input.policy_pack_not_observe
      ? 'Governance policy pack still in observe mode'
      : null,
  };

  return {
    eu_ai_act_readiness,
    gdpr_readiness,
    soc2_readiness,
    iso42001_readiness,
    governance_score,
    governance_label: governanceLabel(governance_score),
    action_items: deduped,
    primary_gaps,
  };
}

export { frameworkStatus };
