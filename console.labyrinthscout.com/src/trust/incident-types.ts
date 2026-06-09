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

  if (/sandbox|escape|namespace|runtime/.test(text)) {
    return 'type1';
  }
  if (/injection|anomaly|reasoning|prompt|rag|poison|jailbreak|honeypot/.test(text)) {
    return 'type3';
  }
  if (/quarantine|egress|privilege|kill_switch|tool_block|blocked|suspend/.test(text)) {
    return 'type2';
  }
  if (severity === 'breach' || severity === 'critical') {
    return 'type3';
  }
  return 'other';
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
