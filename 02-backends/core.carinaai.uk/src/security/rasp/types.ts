export type RASPSignalSource =
  | 'prompt_guard'
  | 'tool_sequence'
  | 'egress_filter'
  | 'trust_state'
  | 'honeypot'
  | 'anomaly';

export type MitreTacticId =
  | 'TA0001'
  | 'TA0002'
  | 'TA0003'
  | 'TA0005'
  | 'TA0006'
  | 'TA0009'
  | 'TA0010'
  | 'TA0043';

export type RASPSignal = {
  id?: string;
  source: RASPSignalSource;
  type: string;
  severity: number;
  confidence: number;
  timestamp: number;
  patternId?: string;
  mitreTactic?: MitreTacticId;
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
