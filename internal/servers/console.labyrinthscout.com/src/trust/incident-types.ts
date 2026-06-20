export type IncidentType = 'type1' | 'type2' | 'type3' | 'other';

export interface ClassifiedIncident {
  id: string;
  incident_type: IncidentType;
  incident_label: string;
  severity: string;
  event_type: string;
  description: string;
  instance_id: string | null;
  session_id: string | null;
  created_at: string;
}

const TYPE_LABELS: Record<IncidentType, string> = {
  type1: 'Type 1; Runtime escape',
  type2: 'Type 2; Privilege escape',
  type3: 'Type 3; Reasoning compromise',
  other: 'Security event',
};

export function classifyIncident(
  eventType: string,
  severity: string,
  description: string,
): IncidentType {
  const type = eventType.toLowerCase();
  const text = `${type} ${description}`.toLowerCase();

  if (/sandbox|escape|namespace|runtime_violation|runtime_escape/.test(text)) {
    return 'type1';
  }
  if (/injection|prompt_injection|reasoning|rag_poison|jailbreak|honeypot_triggered/.test(text)) {
    return 'type3';
  }
  if (/quarantine|egress_block|egress_blocked|privilege|kill_switch|tool_block|session_block|suspend/.test(text)) {
    return 'type2';
  }
  if (/anomaly|z_score/.test(text)) {
    return 'type3';
  }
  if (severity === 'breach') {
    return 'type3';
  }
  if (severity === 'critical' && /injection|egress|honeypot|danger/.test(text)) {
    return 'type3';
  }
  return 'other';
}

/** SQL filter mirroring classifyIncident priority for incident timeline queries. */
export function incidentTypeSqlCondition(type: IncidentType, alias = 'e'): string | null {
  if (type === 'other') return null;

  const text = `LOWER(COALESCE(${alias}.event_type, '') || ' ' || COALESCE(${alias}.description, ''))`;
  const severity = `${alias}.severity`;

  if (type === 'type1') {
    return `(${text} ~ 'sandbox|escape|namespace|runtime_violation|runtime_escape')`;
  }
  if (type === 'type2') {
    return `(${text} ~ 'quarantine|egress_block|egress_blocked|privilege|kill_switch|tool_block|session_block|suspend')`;
  }
  if (type === 'type3') {
    return `(
      ${text} ~ 'injection|prompt_injection|reasoning|rag_poison|jailbreak|honeypot_triggered|anomaly|z_score'
      OR ${severity} = 'breach'
      OR (${severity} = 'critical' AND ${text} ~ 'injection|egress|honeypot|danger')
    ) AND NOT (${text} ~ 'sandbox|escape|namespace|runtime_violation|runtime_escape')
    AND NOT (${text} ~ 'quarantine|egress_block|egress_blocked|privilege|kill_switch|tool_block|session_block|suspend')`;
  }
  return null;
}

export function incidentLabel(type: IncidentType): string {
  return TYPE_LABELS[type];
}

export function mapEventToIncident(row: {
  id: string;
  severity: string;
  event_type: string;
  description: string;
  instance_id: string | null;
  session_id: string | null;
  created_at: Date | string;
}): ClassifiedIncident {
  const incidentType = classifyIncident(row.event_type, row.severity, row.description);
  return {
    id: row.id,
    incident_type: incidentType,
    incident_label: incidentLabel(incidentType),
    severity: row.severity,
    event_type: row.event_type,
    description: row.description,
    instance_id: row.instance_id,
    session_id: row.session_id,
    created_at: new Date(row.created_at).toISOString(),
  };
}
