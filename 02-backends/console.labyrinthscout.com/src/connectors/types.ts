export type ConnectorCategory =
  | 'siem'
  | 'edr'
  | 'cloud'
  | 'supply-chain'
  | 'ticketing'
  | 'soar';

export type ScoutFindingType =
  | 'prompt_injection'
  | 'honeypot_triggered'
  | 'anomaly_spike'
  | 'kill_activated'
  | 'egress_violation'
  | 'tool_abuse'
  | 'vulnerability'
  | 'risk_score_change'
  | 'trust_attestation_failed';

export type ScoutFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  default?: string;
  help?: string;
}

export interface ConnectorHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
  lastChecked: string;
}

export interface PushResult {
  ok: boolean;
  vendorId: string;
  vendorUrl?: string;
  error?: string;
  pushedAt: string;
}

export interface VendorStatus {
  vendorId: string;
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'unknown';
  assignee?: string;
  updatedAt?: string;
  rawResponse?: unknown;
}

export interface ScoutFinding {
  id: string;
  type: ScoutFindingType;
  severity: ScoutFindingSeverity;
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  sessionId: string;
  timestamp: string;
  mitreAttackIds: string[];
  evidence?: {
    prompt?: string;
    toolCall?: string;
    response?: string;
    sourceIp?: string;
    userAgent?: string;
  };
  remediation?: string;
  riskScore: number;
  scoutScore?: number;
  accountId: string;
}

export interface ScoutAlert {
  id: string;
  findingId: string;
  severity: ScoutFindingSeverity;
  title: string;
  message: string;
  timestamp: string;
  requiresImmediate: boolean;
}

export interface SiemConnector {
  id: string;
  name: string;
  category: ConnectorCategory;
  version: string;
  description: string;
  configSchema: ConnectorConfigField[];
  init(config: Record<string, string>): Promise<void>;
  health(): Promise<ConnectorHealth>;
  pushFinding(finding: ScoutFinding): Promise<PushResult>;
  pushAlert(alert: ScoutAlert): Promise<PushResult>;
  getStatus(vendorId: string): Promise<VendorStatus>;
  shutdown(): Promise<void>;
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  category: ConnectorCategory;
  version: string;
  description: string;
  configSchema: ConnectorConfigField[];
}

export type ConnectorFactory = () => SiemConnector;
