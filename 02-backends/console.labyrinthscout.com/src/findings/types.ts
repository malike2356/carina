export type TargetType = 'domain' | 'ip' | 'cidr';
export type ScanStatus = 'queued' | 'running' | 'completed' | 'failed';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';
export type AlertType = 'new_critical' | 'severity_change' | 'new_target' | 'scan_complete';

export interface Target {
  id: string;
  accountId: string;
  target: string;
  targetType: TargetType;
  label: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ScanRun {
  id: string;
  targetId: string;
  accountId: string;
  tool: string;
  status: ScanStatus;
  startedAt: string | null;
  completedAt: string | null;
  findingsCount: number;
  errorMessage: string | null;
  rawOutputPath: string | null;
  createdAt: string;
}

export interface Finding {
  id: string;
  scanRunId: string | null;
  targetId: string;
  accountId: string;
  tool: string;
  findingType: string;
  severity: FindingSeverity;
  cvssScore: number | null;
  title: string;
  description: string | null;
  remediation: string | null;
  rawData: Record<string, unknown>;
  status: FindingStatus;
  isNew: boolean;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
}

export interface ScoutScoreSnapshot {
  score: number;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  calculatedAt: string;
  openPorts?: number;
  label?: string;
  breakdown?: {
    exposure: number;
    vulnerabilities: number;
    compliance: number;
    agentSafety: number;
  };
}

export interface FindingListFilters {
  severity?: FindingSeverity;
  tool?: string;
  status?: FindingStatus;
  targetId?: string;
  limit?: number;
  offset?: number;
}

export interface CreateTargetInput {
  accountId: string;
  target: string;
  targetType: TargetType;
  label?: string;
}

export interface CreateFindingInput {
  accountId: string;
  targetId: string;
  tool: string;
  findingType: string;
  severity: FindingSeverity;
  title: string;
  description?: string;
  remediation?: string;
  cvssScore?: number;
  rawData?: Record<string, unknown>;
  scanRunId?: string;
}

export interface UpdateFindingInput {
  status?: FindingStatus;
  severity?: FindingSeverity;
  description?: string;
  remediation?: string;
  isNew?: boolean;
}
