export type CustodyAction = 'created' | 'accessed' | 'modified' | 'exported' | 'deleted';

export type CustodyRecord = {
  id: string;
  evidenceId: string;
  action: CustodyAction;
  actor: string;
  actorRole: string;
  timestamp: number;
  reason: string;
  previousHash: string;
  hash: string;
};

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';
export type IncidentStatus = 'active' | 'contained' | 'investigating' | 'resolved';

export type ForensicIncident = {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  detectedAt: number;
  resolvedAt?: number;
  sessionId?: string;
  agentId?: string;
  classification?: string;
  triggerEventTypes?: string[];
  createdAt: string;
};

export type MessageSnapshot = {
  role: string;
  contentPreview: string;
  timestamp?: string;
};

export type ForensicArtifactRef = {
  path: string;
  hash: string;
  size: number;
};

export type ForensicSnapshot = {
  id: string;
  incidentId: string;
  timestamp: number;
  capturedBy: string;
  hash: string;
  agentState: {
    sessionId: string;
    agentId: string;
    modelId: string;
    providerId: string;
    messages: MessageSnapshot[];
    activeTools: string[];
    memoryState: Record<string, unknown>;
  };
  systemState: {
    osInfo: Record<string, unknown>;
    nodeVersion: string;
    carinaVersion: string;
    uptime: number;
    memoryUsage: Record<string, unknown>;
  };
  securityState: {
    trustScore: number;
    activeThreats: number;
    shieldStatus: string;
    killSwitchStatus: string;
    recentEvents: Array<Record<string, unknown>>;
  };
  artifacts: {
    sessionLog: ForensicArtifactRef;
    toolCallLog: ForensicArtifactRef;
    promptLog: ForensicArtifactRef;
    networkLog: ForensicArtifactRef;
    memoryDump: ForensicArtifactRef;
  };
};

export type TimelineEventType =
  | 'user_message'
  | 'agent_response'
  | 'tool_call'
  | 'tool_result'
  | 'security_event'
  | 'system_event'
  | 'network_event'
  | 'error';

export type TimelineEvent = {
  id: string;
  incidentId: string;
  timestamp: number;
  type: TimelineEventType;
  severity: 'info' | 'warning' | 'critical';
  source: string;
  description: string;
  details: Record<string, unknown>;
  relatedEvents: string[];
  suspicious?: boolean;
};

export type IRStepAction = 'contain' | 'investigate' | 'notify' | 'recover' | 'report';

export type IRStep = {
  order: number;
  action: IRStepAction;
  description: string;
  automated: boolean;
};

export type IRPlaybook = {
  id: string;
  name: string;
  trigger: {
    eventTypes: string[];
    severity: 'warning' | 'critical';
    autoExecute: boolean;
  };
  steps: IRStep[];
};

export type PlaybookExecution = {
  id: string;
  incidentId: string;
  playbookId: string;
  playbookName: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  stepsCompleted: number;
  stepsTotal: number;
  automatedOnly: boolean;
  log: string[];
};

export type RootCauseAnalysis = {
  attackPath: string[];
  impact: string[];
  durationMs: number | null;
  recommendations: string[];
  classification: string;
};

export type ForensicReport = {
  incident: ForensicIncident;
  snapshot?: ForensicSnapshot;
  timeline: TimelineEvent[];
  rootCause: RootCauseAnalysis;
  custodyVerification: { valid: boolean; brokenAt: number | null };
  generatedAt: string;
};
