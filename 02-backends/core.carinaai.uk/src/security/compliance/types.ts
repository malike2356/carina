export type ComplianceFrameworkId = 'soc2' | 'iso27001' | 'gdpr';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'not_applicable';

export type EvidenceType =
  | 'config'
  | 'log'
  | 'policy'
  | 'procedure'
  | 'screenshot'
  | 'attestation';

export type EvidenceItem = {
  type: EvidenceType;
  description: string;
  source: string;
  value: unknown;
  collectedAt: number;
  expiresAt: number;
};

export type ComplianceControl = {
  id: string;
  name: string;
  framework: ComplianceFrameworkId;
  collectorId: string;
  description?: string;
};

export type ComplianceFramework = {
  id: ComplianceFrameworkId;
  name: string;
  description: string;
};

export type ComplianceEvidence = {
  framework: ComplianceFrameworkId;
  controlId: string;
  controlName: string;
  status: ComplianceStatus;
  evidence: EvidenceItem[];
  lastCollected: number;
  nextCollection: number;
};

export type ComplianceGap = {
  framework: ComplianceFrameworkId;
  controlId: string;
  controlName: string;
  severity: 'warn' | 'fail';
  detail: string;
  remediation?: string;
};

export type ComplianceReport = {
  framework: ComplianceFramework;
  evidence: ComplianceEvidence[];
  generatedAt: string;
  overallStatus: ComplianceStatus;
  scorePercent: number;
  gapAnalysis: ComplianceGap[];
};

export type ComplianceDashboard = {
  generatedAt: string;
  overallStatus: ComplianceStatus;
  overallScorePercent: number;
  frameworks: Array<{
    id: ComplianceFrameworkId;
    name: string;
    scorePercent: number;
    compliant: number;
    total: number;
  }>;
  gaps: ComplianceGap[];
  lastCollectionAt?: string;
  nextScheduledAt?: string;
};

export type DsarRequestType = 'access' | 'delete' | 'portability';

export type DsarResult = {
  userId: string;
  requestType: DsarRequestType;
  completedAt: string;
  exportPath?: string;
  deletedRecords?: number;
  verified?: boolean;
  summary: string;
};

export type BreachNotification = {
  incidentId: string;
  generatedAt: string;
  requiresSupervisoryNotification: boolean;
  hoursSinceDetection: number;
  severity: string;
  summary: string;
  notificationBody: string;
  loggedToAuthority: boolean;
  dataSubjectsNotified: boolean;
};

export type ComplianceIncident = {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectedAt: number;
  involvesPersonalData?: boolean;
  affectsDataSubjects?: boolean;
  sessionId?: string;
};
