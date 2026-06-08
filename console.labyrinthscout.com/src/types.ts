export type Severity = 'info' | 'warning' | 'critical' | 'breach';

export type InstanceStatus = 'active' | 'suspended' | 'offline';

export interface SecurityEventRow {
  id: string;
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  session_id: string | null;
  instance_id: string | null;
  mitigated: boolean;
  created_at: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_note: string | null;
}

export interface CarinaInstanceRow {
  id: string;
  name: string;
  api_key: string;
  status: InstanceStatus;
  suspension_reason: string | null;
  last_heartbeat: string | null;
  created_at: string;
}

export interface AlertChannelRow {
  id: string;
  channel_type: 'telegram' | 'email' | 'slack';
  severity_threshold: Severity;
  enabled: boolean;
  config: Record<string, string>;
  created_at: string;
}

export interface IncomingEventPayload {
  severity: Severity;
  source: string;
  event_type: string;
  description: string;
  metadata?: Record<string, unknown>;
  ip_address?: string;
  session_id?: string;
  instance_id?: string;
}

export interface HeartbeatPayload {
  instance_id: string;
  name: string;
}

export interface StatusResponse {
  instances: Array<{
    id: string;
    name: string;
    status: InstanceStatus;
    last_heartbeat: string | null;
    secondsAgo: number | null;
    suspension_reason: string | null;
  }>;
  stats: {
    critical: number;
    warning: number;
    info: number;
    breach: number;
  };
  toolCalls: Record<string, number>;
}
