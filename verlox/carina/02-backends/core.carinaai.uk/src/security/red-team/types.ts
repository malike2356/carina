export type RedTeamAttackType =
  | 'prompt_injection'
  | 'tool_sequence_attack'
  | 'data_exfiltration';

export type SecurityGapSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SecurityGap = {
  severity: SecurityGapSeverity;
  description: string;
  system: string;
  recommendation: string;
  autoCreatedRule: boolean;
};

export type RedTeamExercise = {
  id: string;
  name: string;
  attackType: RedTeamAttackType;
  mitreTactic: string;
  targetSystems: string[];
  schedule: string;
  lastRun?: number;
  results: RedTeamResult[];
};

export type RedTeamResult = {
  exerciseId: string;
  timestamp: number;
  attackVector: string;
  detected: boolean;
  detectionTime: number;
  blocked: boolean;
  blockTime: number;
  falsePositives: number;
  gaps: SecurityGap[];
};

export type AttackExecution = {
  vector: string;
  systems: string[];
  detected: boolean;
  blocked: boolean;
  detectionTimeMs: number;
  blockTimeMs: number;
  falsePositives: number;
  details: Record<string, unknown>;
};

export type RedTeamReport = {
  generatedAt: string;
  exercisesRun: number;
  results: RedTeamResult[];
  unresolvedGaps: SecurityGap[];
};

export type DetectionRule = {
  id: string;
  name: string;
  system: string;
  pattern: string;
  severity: SecurityGapSeverity;
  createdBy: string;
  createdAt: number;
  status: 'active' | 'disabled';
  sourceGap?: string;
};

export type RedTeamScheduleEntry = {
  id: string;
  name: string;
  schedule: string;
  lastRun?: string;
  nextHint: string;
};
