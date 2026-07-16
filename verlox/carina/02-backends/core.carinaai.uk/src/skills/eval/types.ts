export type EvalGateMode = 'off' | 'warn' | 'require' | 'bypass';

export type AssertionType =
  | 'skill_match'
  | 'skill_rank'
  | 'keyword_overlap'
  | 'contains'
  | 'not_contains'
  | 'matches_regex'
  | 'max_latency_ms'
  | 'max_tokens'
  | 'tools_include';

export interface EvalAssertion {
  type: AssertionType;
  skill?: string;
  rank?: number;
  min?: number;
  value?: string;
  pattern?: string;
  tools?: string[];
  keywords?: string[];
  message?: string;
}

export interface EvalFixtureInput {
  query: string;
  keywords?: string[];
  simulateOutput?: string;
  tokensUsed?: number;
}

export interface EvalFixture {
  id: string;
  description?: string;
  input: EvalFixtureInput;
  assertions: EvalAssertion[];
  tags?: string[];
}

export interface EvalThresholds {
  minPassRate?: number;
  maxMeanLatencyMs?: number;
  maxLatencyStdDevMs?: number;
  maxMeanTokens?: number;
  maxTokenDelta?: number;
  maxRegressionDelta?: number;
}

export interface EvalDefinition {
  version: string;
  pack?: string;
  skill?: string;
  description?: string;
  thresholds?: EvalThresholds;
  fixtures: EvalFixture[];
  /** Inline skill overrides for candidate/baseline comparison */
  skills?: EvalSkillOverride[];
}

export interface EvalSkillOverride {
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
}

export interface AssertionResult {
  assertion: EvalAssertion;
  passed: boolean;
  message: string;
}

export interface FixtureRunResult {
  fixtureId: string;
  pass: boolean;
  latencyMs: number;
  tokensUsed: number;
  matchedSkills: string[];
  output?: string;
  assertionResults: AssertionResult[];
}

export interface RunMetrics {
  passRate: number;
  passCount: number;
  failCount: number;
  meanLatencyMs: number;
  stdDevLatencyMs: number;
  meanTokens: number;
  stdDevTokens: number;
  failuresByType: Record<string, number>;
}

export interface EvalRunResult {
  runId: string;
  pack: string;
  label: string;
  passes: number;
  startedAt: string;
  finishedAt: string;
  fixtureResults: FixtureRunResult[];
  metrics: RunMetrics;
  thresholds?: EvalThresholds;
  thresholdsMet: boolean;
  notes?: string[];
}

export interface BaselineComparison {
  baseline: EvalRunResult;
  candidate: EvalRunResult;
  passRateDelta: number;
  latencyDeltaMs: number;
  tokenDelta: number;
  improved: boolean;
  regression: boolean;
  failingFixtures: string[];
  newFailures: string[];
  fixedFixtures: string[];
}

export interface BlindComparisonSlot {
  slot: 'A' | 'B';
  runId: string;
  label: string;
  metrics: RunMetrics;
}

export interface BlindComparisonResult {
  comparisonId: string;
  slotA: BlindComparisonSlot;
  slotB: BlindComparisonSlot;
  winner: 'A' | 'B' | 'tie';
  revealed: {
    aLabel: string;
    bLabel: string;
  };
  passRateDelta: number;
  notes: string[];
}

export interface EvalReport {
  runId: string;
  generatedAt: string;
  summary: string;
  result: EvalRunResult;
  comparison?: BaselineComparison;
  markdown: string;
}

export interface EvalGateResult {
  mode: EvalGateMode;
  passed: boolean;
  blocked: boolean;
  message: string;
  runId?: string;
  reportPath?: string;
}

export interface RunEvalOptions {
  packOrPath: string;
  label?: string;
  passes?: number;
  skillsOverride?: EvalSkillOverride[];
  executeWithLlm?: boolean;
  outputDir?: string;
}

export interface CompareEvalOptions {
  baselinePath: string;
  candidatePath: string;
  blind?: boolean;
  passes?: number;
}
