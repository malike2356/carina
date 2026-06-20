import type { ForensicIncident } from '../forensics/types.js';

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export type DashboardEventAction = 'blocked' | 'monitor' | 'alert' | 'log';

export type SecurityEvent = {
  id: string;
  timestamp: string;
  label: string;
  action: DashboardEventAction;
  agentId: string;
  sessionId?: string;
  source: string;
};

export type ComplianceStatusSummary = {
  overallScorePercent: number;
  overallStatus: string;
  frameworks: Array<{ id: string; name: string; scorePercent: number }>;
};

export type SupplyChainHealth = {
  dependencyCount: number;
  vulnerabilityCount: number;
  criticalCount: number;
  sbomGeneratedAt: string | null;
  lastScanAt: string | null;
  verdict: 'clean' | 'warning' | 'blocked' | 'unknown';
};

export type SecretsStatus = {
  activeCount: number;
  expiringSoonCount: number;
  staleCount: number;
  rows: Array<{ provider: string; expiresInDays: number; stale: boolean }>;
};

export type RedTeamSummary = {
  lastRunAt: string | null;
  exercisesRun: number;
  passedCount: number;
  totalCount: number;
  passRatePercent: number;
  criticalGaps: number;
};

export type ScoutDashboardStatus = {
  connected: boolean;
  armed: boolean;
  url: string | null;
};

export type TrustScorePoint = {
  date: string;
  score: number;
};

export type SecurityDashboardData = {
  generatedAt: string;
  threatLevel: ThreatLevel;
  activeThreats: number;
  trustScore: number;
  trustScoreTrend: number;
  trustHistory: TrustScorePoint[];
  incidentsThisWeek: number;
  incidentsTrend: number;
  raspStatus: 'active' | 'degraded' | 'offline';
  scoutStatus: ScoutDashboardStatus;
  realTimeEvents: SecurityEvent[];
  complianceStatus: ComplianceStatusSummary;
  supplyChainHealth: SupplyChainHealth;
  secretsStatus: SecretsStatus;
  redTeamResults: RedTeamSummary;
  recentIncidents: ForensicIncident[];
  governanceHealthy: boolean;
  killSwitchActive: boolean;
};
