export type ScoutFindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScoutFindingStatus =
  | 'open'
  | 'investigating'
  | 'confirmed'
  | 'false_positive'
  | 'resolved';

export interface ScoutFinding {
  id: string;
  scanRunId: string | null;
  targetId: string;
  accountId: string;
  tool: string;
  findingType: string;
  severity: ScoutFindingSeverity;
  cvssScore: number | null;
  title: string;
  description: string | null;
  remediation: string | null;
  rawData: Record<string, unknown>;
  status: ScoutFindingStatus;
  isNew: boolean;
  firstSeen: string;
  lastSeen: string;
  createdAt: string;
}

export interface ScoutFindingsList {
  findings: ScoutFinding[];
}

export interface ScoutScoreSnapshot {
  score: number;
  openCritical: number;
  openHigh: number;
  openMedium: number;
  openLow: number;
  calculatedAt: string;
}

export interface ScoutPullSummary {
  pulledAt: string;
  scoutScore: ScoutScoreSnapshot | null;
  total: number;
  bySeverity: Record<ScoutFindingSeverity, number>;
  byStatus: Record<ScoutFindingStatus, number>;
  newSinceLastPull: number;
  findings: ScoutFinding[];
}

export interface ScoutInvestigation {
  id: string;
  findingId: string;
  status: 'opened' | 'in_progress' | 'closed';
  toolsSuggested: string[];
  notes: string;
  openedAt: string;
  updatedAt: string;
  finding: ScoutFinding;
  obsidianCaseId?: string;
  obsidianCasePath?: string;
}

export interface ScoutInvestigationActiveContext {
  investigationId: string;
  findingId: string;
  caseId: string;
  casePath: string;
  targetId: string;
  org: string;
  openedAt: string;
  sessionId?: string;
}

export interface ScoutFindingsQuery {
  severity?: ScoutFindingSeverity;
  status?: ScoutFindingStatus;
  tool?: string;
  targetId?: string;
  limit?: number;
  offset?: number;
  accountId?: string;
}

export interface ScoutApiConfig {
  baseUrl: string;
  apiKey: string;
  accountId?: string;
}
