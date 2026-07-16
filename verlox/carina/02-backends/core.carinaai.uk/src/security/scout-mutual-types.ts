/** Signal categories Carina sends to Scout beyond basic tool-call telemetry. */
export const SCOUT_SIGNAL_CATEGORIES = [
  'threat_analysis',
  'investigation',
  'recommendation',
  'nl_query_result',
  'anomaly_detected',
  'proactive_alert',
] as const;

export type ScoutSignalCategory = (typeof SCOUT_SIGNAL_CATEGORIES)[number];

export type ScoutSignalSeverity = 'info' | 'warning' | 'critical' | 'breach';

export interface ScoutSignal {
  signal_id: string;
  timestamp: string;
  agent_id: string;
  category: ScoutSignalCategory;
  severity?: ScoutSignalSeverity;
  action: string;
  target: string;
  details: Record<string, unknown>;
  mitre_tactic?: string;
  threat_score?: number;
  session_id?: string;
  instance_id?: string;
}

/** Commands Scout sends to Carina over the Redis control channel. */
export const SCOUT_COMMANDS = [
  'suspend',
  'resume',
  'quarantine_tool',
  'investigate_session',
  'analyse_threat',
  'analyze_threat',
  'generate_report',
  'rotate_credentials',
  'activate_honeypots',
] as const;

export type ScoutCommandName = (typeof SCOUT_COMMANDS)[number];

export const SCOUT_AGENTIC_COMMANDS: ReadonlySet<string> = new Set([
  'investigate_session',
  'analyse_threat',
  'analyze_threat',
  'generate_report',
  'rotate_credentials',
  'activate_honeypots',
]);

export function isAgenticScoutCommand(action: unknown): action is ScoutCommandName {
  return typeof action === 'string' && SCOUT_AGENTIC_COMMANDS.has(action);
}

export function defaultSeverityForCategory(category: ScoutSignalCategory): ScoutSignalSeverity {
  switch (category) {
    case 'threat_analysis':
    case 'anomaly_detected':
      return 'warning';
    case 'proactive_alert':
      return 'critical';
    default:
      return 'info';
  }
}
