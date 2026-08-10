/** Shared status page and incident communication types. */

export type OverallStatus = 'operational' | 'degraded' | 'outage' | 'maintenance';

export type IncidentSeverity = 'minor' | 'major' | 'critical';

export type IncidentPhase = 'investigating' | 'identified' | 'monitoring' | 'resolved';

export type ServiceHealth = 'up' | 'down' | 'unknown';

export interface MonitoredEndpoint {
  id: string;
  name: string;
  url: string;
  /** Optional expected HTTP status (default 200). */
  expectStatus?: number;
}

export interface PingResult {
  endpointId: string;
  ok: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  at: string;
}

export interface IncidentUpdate {
  id: string;
  phase: IncidentPhase;
  message: string;
  at: string;
}

export interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  phase: IncidentPhase;
  affectedServices: string[];
  detectedAt: string;
  resolvedAt?: string;
  autoCreated: boolean;
  updates: IncidentUpdate[];
}

export interface MaintenanceWindow {
  id: string;
  title: string;
  description: string;
  affectedServices: string[];
  startsAt: string;
  endsAt: string;
  announcedAt: string;
  remindersSent: Array<'48h' | '24h' | '1h'>;
}

export interface DailyUptime {
  date: string; // YYYY-MM-DD UTC
  okChecks: number;
  totalChecks: number;
  uptimePct: number;
}

export interface StatusSnapshot {
  product: string;
  overall: OverallStatus;
  updatedAt: string;
  services: Array<{ id: string; name: string; health: ServiceHealth }>;
  openIncidents: Incident[];
  recentIncidents: Incident[];
  upcomingMaintenance: MaintenanceWindow[];
  uptime90d: number;
  dailyUptime: DailyUptime[];
}

export interface NotificationRecord {
  id: string;
  channel: 'email_active_users' | 'email_subscribers' | 'social' | 'maintenance_reminder';
  template: string;
  incidentId?: string;
  maintenanceId?: string;
  recipients: string[];
  subject: string;
  body: string;
  at: string;
}

export type EmailSender = (args: {
  to: string[];
  subject: string;
  body: string;
  template: string;
}) => Promise<void> | void;

export type PingFn = (endpoint: MonitoredEndpoint) => Promise<Omit<PingResult, 'endpointId' | 'at'> & { at?: string }>;
