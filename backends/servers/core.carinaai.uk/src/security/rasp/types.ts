export type RASPSignalSource =
  | 'prompt_guard'
  | 'tool_sequence'
  | 'egress_filter'
  | 'trust_state'
  | 'honeypot'
  | 'anomaly';

export type RASPSignal = {
  id?: string;
  source: RASPSignalSource;
  type: string;
  severity: number;
  confidence: number;
  timestamp: number;
  context: {
    sessionId: string;
    agentId: string;
    toolName?: string;
    details: Record<string, unknown>;
  };
};

export type ResponseAction = 'kill' | 'contain' | 'alert' | 'monitor' | 'log';

export type ResponseDecision = {
  action: ResponseAction;
  description: string;
  autoExecute: boolean;
};

export type AttackNode = {
  id: string;
  label: string;
  source: RASPSignalSource;
  severity: number;
  timestamp: number;
  mitreTactic?: string;
  next?: string[];
};

export type ThreatAssessment = {
  id: string;
  threatScore: number;
  confidence: number;
  attackType: string | null;
  mitreTactic: string | null;
  signals: RASPSignal[];
  attackGraph: AttackNode[];
  decision: ResponseDecision;
  timestamp: number;
  sessionId: string;
  executed?: boolean;
};

export type RaspStatus = {
  enabled: boolean;
  correlationWindowMs: number;
  activeSignalCount: number;
  assessmentCount: number;
  lastAssessment?: ThreatAssessment;
  suspended: boolean;
  blockedSessionCount: number;
};
