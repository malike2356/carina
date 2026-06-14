export type EuAiActTier =
  | 'minimal_risk'
  | 'limited_risk'
  | 'high_risk'
  | 'unacceptable_risk';

export type UkDsitAlignment =
  | 'aligned'
  | 'partial'
  | 'not_assessed';

export interface RegulatoryClassificationInput {
  risk_score: number;
  unresolved_critical: number;
  kill_switch_armed: boolean;
  kill_switch_triggered: boolean;
  erc8004_status: string;
  agents_total: number;
  last_attestation_at: string | null;
  alert_channels_configured: boolean;
  audit_events_last_7d: boolean;
  egress_filter_enabled: boolean;
  breach_events_24h: number;
  telemetry_days: number;
}

export interface RegulatoryClassification {
  eu_ai_act: {
    tier: EuAiActTier;
    tier_label: string;
    reasoning: string[];
    article_refs: string[];
    gaps: string[];
  };
  uk_dsit: {
    alignment: UkDsitAlignment;
    alignment_label: string;
    principles_met: string[];
    principles_partial: string[];
  };
  assessed_at: string;
  data_sufficient: boolean;
}

const TIER_LABELS: Record<EuAiActTier, string> = {
  minimal_risk: 'Minimal Risk',
  limited_risk: 'Limited Risk',
  high_risk: 'High Risk',
  unacceptable_risk: 'Unacceptable Risk',
};

const ARTICLE_REFS: Record<EuAiActTier, string[]> = {
  minimal_risk: ['Recital 47 - no specific obligations'],
  limited_risk: ['Article 52 - transparency obligations'],
  high_risk: [
    'Article 6',
    'Annex III',
    'Article 9 - risk management system required',
    'Article 12 - logging obligations',
    'Article 14 - human oversight',
  ],
  unacceptable_risk: ['Article 5 - prohibited practice'],
};

const ALIGNMENT_LABELS: Record<UkDsitAlignment, string> = {
  aligned: 'Aligned with DSIT white paper principles',
  partial: 'Partial alignment with DSIT principles',
  not_assessed: 'Not assessed (insufficient telemetry)',
};

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const ms = now.getTime() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86_400_000);
}

export function classifyRegulatoryRisk(
  input: RegulatoryClassificationInput,
  now: Date = new Date(),
): RegulatoryClassification {
  const dataSufficient = input.telemetry_days >= 3;
  const reasoning: string[] = [];
  const gaps: string[] = [];

  reasoning.push(`Risk score is ${input.risk_score} (threshold: <= 20 for Minimal Risk)`);

  if (input.kill_switch_armed) {
    reasoning.push('Kill switch is armed and configured');
  } else {
    gaps.push('Arm the kill switch to qualify for Minimal Risk');
  }

  if (input.erc8004_status === 'live') {
    reasoning.push('ERC-8004 agent identity registered on-chain');
  } else if (input.agents_total > 0) {
    gaps.push('Register ERC-8004 agent identity on-chain');
  }

  if (input.unresolved_critical === 0) {
    reasoning.push('No unresolved critical incidents in the last 30 days');
  } else {
    reasoning.push(`${input.unresolved_critical} unresolved critical incident(s) open`);
  }

  if (input.alert_channels_configured) {
    reasoning.push('Alert channels are configured');
  } else {
    gaps.push('Configure alert channels for operator notification');
  }

  const attestationDays = daysSince(input.last_attestation_at, now);
  if (attestationDays !== null && attestationDays <= 30) {
    reasoning.push('On-chain attestation is within the last 30 days');
  } else {
    gaps.push('Submit an on-chain attestation within the last 30 days');
  }

  let tier: EuAiActTier = 'limited_risk';

  const unacceptable = input.risk_score >= 90
    && input.kill_switch_triggered
    && input.breach_events_24h > 0;

  if (unacceptable) {
    tier = 'unacceptable_risk';
    gaps.unshift('Resolve breach events and disarm kill switch after incident review');
  } else if (
    input.risk_score >= 60
    || input.unresolved_critical > 0
    || input.kill_switch_triggered
    || (input.erc8004_status !== 'live' && input.agents_total > 0)
  ) {
    tier = 'high_risk';
    if (input.risk_score >= 60) gaps.push('Reduce operational risk score below 60');
    if (input.unresolved_critical > 0) gaps.push('Resolve all critical incidents');
  } else if (
    input.risk_score <= 20
    && input.kill_switch_armed
    && attestationDays !== null
    && attestationDays <= 30
    && input.alert_channels_configured
    && input.unresolved_critical === 0
  ) {
    tier = 'minimal_risk';
    gaps.length = 0;
  }

  const principlesMet: string[] = [];
  const principlesPartial: string[] = ['Fairness', 'Explainability', 'Contestability'];

  if (input.kill_switch_armed) principlesMet.push('Safety');
  if (input.alert_channels_configured && input.egress_filter_enabled) principlesMet.push('Security');
  if (input.erc8004_status === 'live') principlesMet.push('Accountability');
  if (input.audit_events_last_7d) principlesMet.push('Transparency');
  if (attestationDays !== null && attestationDays <= 30) principlesMet.push('Governance');

  let alignment: UkDsitAlignment = 'not_assessed';
  const telemetryHours = input.telemetry_days * 24;
  if (!dataSufficient || telemetryHours < 72) {
    alignment = 'not_assessed';
  } else if (
    input.audit_events_last_7d
    && input.kill_switch_armed
    && input.last_attestation_at != null
  ) {
    alignment = 'aligned';
  } else if (input.audit_events_last_7d) {
    alignment = 'partial';
  } else {
    alignment = 'partial';
  }

  return {
    eu_ai_act: {
      tier,
      tier_label: TIER_LABELS[tier],
      reasoning: reasoning.slice(0, 5),
      article_refs: ARTICLE_REFS[tier],
      gaps: tier === 'minimal_risk' ? [] : [...new Set(gaps)].slice(0, 6),
    },
    uk_dsit: {
      alignment,
      alignment_label: ALIGNMENT_LABELS[alignment],
      principles_met: principlesMet,
      principles_partial: principlesPartial,
    },
    assessed_at: now.toISOString(),
    data_sufficient: dataSufficient,
  };
}
