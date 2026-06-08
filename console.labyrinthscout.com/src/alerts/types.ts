export type AlertSeverity = 'info' | 'warning' | 'critical' | 'breach';

export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  info: 1,
  warning: 2,
  critical: 3,
  breach: 4,
};

export interface SecurityEvent {
  id: string;
  instance_id: string;
  session_id: string;
  event_type: string;
  severity: AlertSeverity;
  description: string;
  created_at: Date;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: Date | null;
}

export interface AlertChannel {
  id: string;
  channel_type: 'telegram' | 'email' | 'slack' | 'sms' | 'discord';
  severity_threshold: AlertSeverity;
  enabled: boolean;
  config: Record<string, string>;
}

export interface AlertAdapter {
  send(event: SecurityEvent, channel: AlertChannel): Promise<void>;
}
