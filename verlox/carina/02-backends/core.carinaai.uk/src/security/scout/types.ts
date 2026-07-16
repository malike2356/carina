export type ScoutSecurityEvent = {
  id: string;
  severity: string;
  source: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  ip_address?: string | null;
  session_id?: string | null;
  instance_id?: string | null;
  created_at: string;
};

export type ScoutCorrelationMatch = {
  id: string;
  ruleId: string;
  matchedEvents: string[];
  caseId: string | null;
  firedAt: string;
};

export type ThreatAnalysisReport = {
  reportId: string;
  generatedAt: string;
  threatId: string;
  classification: string;
  confidence: number;
  threatScore: number;
  mitreTactics: string[];
  attackChain: string[];
  impactAssessment: string;
  recommendedActions: string[];
  evidenceEventIds: string[];
  summary: string;
};

export type InvestigationVerdict = 'benign' | 'suspicious' | 'malicious' | 'inconclusive';

export type InvestigationReport = {
  reportId: string;
  generatedAt: string;
  sessionId: string;
  verdict: InvestigationVerdict;
  confidence: number;
  threatScore: number;
  attackChain: string[];
  correlatedSessions: string[];
  summary: string;
  recommendedActions: string[];
  evidence: ScoutSecurityEvent[];
};

export type NlQueryResult = {
  query: string;
  parsedFilters: Record<string, unknown>;
  eventCount: number;
  summary: string;
  evidence: ScoutSecurityEvent[];
};

export type ProactiveRecommendation = {
  id: string;
  priority: number;
  riskScore: number;
  category: string;
  title: string;
  detail: string;
  suggestedAction: string;
  generatedAt: string;
};

export type AutoResponseAlert = {
  eventType: string;
  severity: string;
  threatScore?: number;
  sessionId?: string;
  instanceId?: string;
  correlatedEventCount?: number;
  tier?: 'emergency' | 'high' | 'medium' | 'low';
  metadata?: Record<string, unknown>;
};

export type ResponseAdvice = {
  shouldExecute: boolean;
  confidence: number;
  verdict: 'false_positive' | 'confirmed_threat' | 'needs_review';
  reasoning: string;
  recommendedActions: string[];
  autoExecuteAllowed: boolean;
};
