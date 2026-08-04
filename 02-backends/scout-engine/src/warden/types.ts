export type SensorName =
  | 'carina'
  | 'scout'
  | 'host'
  | 'network'
  | 'connected_systems'
  | 'devices'
  | 'deployed_agents'
  | 'supply_chain';

export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ConfidenceBand = 'low' | 'medium' | 'high';

export interface SensorSignal {
  id: string;
  sensor: SensorName;
  title: string;
  description: string;
  severity: number;
  confidence: number;
  evidence: Record<string, unknown>;
  timestamp: string;
  artifactPath?: string;
  processId?: number;
  remoteIp?: string;
  domain?: string;
}

export type ResponseAction =
  | 'log'
  | 'flag'
  | 'isolate'
  | 'sandbox'
  | 'immobilize'
  | 'strip'
  | 'remove'
  | 'kill_carina'
  | 'lock_host';

export type ThreatStatus = 'open' | 'responding' | 'contained' | 'removed';

export interface ThreatVerdict {
  id: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  severityScore: number;
  confidence: number;
  confidenceBand: ConfidenceBand;
  riskScore: number;
  signals: SensorSignal[];
  actions: ResponseAction[];
  status: ThreatStatus;
  createdAt: string;
  updatedAt: string;
  reportId?: string;
}

export interface ResponseResult {
  action: ResponseAction;
  target: string;
  ok: boolean;
  dryRun: boolean;
  detail: string;
  evidence?: Record<string, unknown>;
}

export interface WardenEvent {
  id: string;
  threatId: string;
  timestamp: string;
  title: string;
  severity: SeverityLevel;
  riskScore: number;
  status: ThreatStatus;
  responses: ResponseResult[];
  evidenceDir?: string;
}

export interface ArsenalResult {
  tool: string;
  ok: boolean;
  available: boolean;
  summary: string;
  findings: Record<string, unknown>;
  durationMs: number;
  raw?: string;
}

export interface ScanJob {
  id: string;
  mode: 'quick' | 'full' | 'deep';
  status: 'queued' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  sensorResults: Partial<Record<SensorName, SensorSignal[]>>;
  threats: ThreatVerdict[];
}

export interface SensorStatus {
  name: SensorName;
  enabled: boolean;
  lastRunAt?: string;
  lastSignalCount: number;
  healthy: boolean;
  error?: string;
}

export interface WardenStatus {
  enabled: boolean;
  dryRun: boolean;
  posture: 'secure' | 'elevated' | 'compromised' | 'unknown';
  openThreats: number;
  criticalThreats: number;
  lastScanId?: string;
  lastScanAt?: string;
  sensors: SensorStatus[];
  arsenalAvailability: Record<string, boolean>;
}
