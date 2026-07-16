export type AnomalyType =
  | 'token_spike'
  | 'unusual_tool_sequence'
  | 'unusual_hours'
  | 'new_tool_usage'
  | 'rapid_cycling'
  | 'sensitive_tool_access'
  | 'new_ip_location';

export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AnomalyResponse {
  severity: AnomalySeverity;
  autoAction: string;
}

export const ANOMALY_RESPONSES: Record<AnomalyType, AnomalyResponse> = Object.freeze({
  token_spike: {
    severity: 'high',
    autoAction: 'alert_dashboard_telegram_temporary_rate_limit',
  },
  unusual_tool_sequence: {
    severity: 'medium',
    autoAction: 'alert_dashboard',
  },
  unusual_hours: {
    severity: 'medium',
    autoAction: 'alert_dashboard',
  },
  new_tool_usage: {
    severity: 'medium',
    autoAction: 'alert_dashboard',
  },
  rapid_cycling: {
    severity: 'high',
    autoAction: 'temporary_rate_limit',
  },
  sensitive_tool_access: {
    severity: 'critical',
    autoAction: 'require_admin_approval',
  },
  new_ip_location: {
    severity: 'low',
    autoAction: 'log_dashboard',
  },
});
