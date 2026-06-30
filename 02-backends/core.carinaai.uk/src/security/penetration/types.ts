import type { OrgRole } from '../../hosted/org-types.js';
import type { SequenceStep } from '../tool-sequence-guard.js';

export type PenTestSeverity = 'critical' | 'high' | 'medium' | 'low';

export type PenTestStep =
  | { send_message: string }
  | { send_tool_result: string }
  | { scan_memory_write: { content: string; source: 'user' | 'tool_result' | 'inference' } }
  | { authenticate_as: OrgRole | 'regular_user' }
  | { read_path: string }
  | { set_env: Record<string, string> }
  | { simulate_tool_sequence: Array<{ tool: string; params?: Record<string, unknown> }> }
  | { simulate_attack: string }
  | { wait: string }
  | { assert: PenTestAssertion };

export type PenTestAssertion = Record<string, string | boolean | number>;

export type PenTestScenario = {
  id: string;
  name: string;
  severity: PenTestSeverity;
  description: string;
  sourceFile: string;
  steps: PenTestStep[];
};

export type AssertionFailure = {
  key: string;
  expected: unknown;
  actual: unknown;
  message: string;
};

export type ScenarioResult = {
  id: string;
  name: string;
  severity: PenTestSeverity;
  passed: boolean;
  durationMs: number;
  failures: AssertionFailure[];
  sourceFile: string;
};

export type PenTestReport = {
  totalScenarios: number;
  passed: number;
  failed: number;
  criticalFailures: number;
  results: ScenarioResult[];
  generatedAt: string;
};

export type ScenarioRuntimeContext = {
  sessionId: string;
  message?: string;
  role?: OrgRole;
  path?: string;
  toolResults: string[];
  toolSequence: SequenceStep[];
  sequenceViolationRuleId?: string;
  promptGuardBlocked: boolean;
  promptGuardReason?: string;
  toolResultGuardBlocked: boolean;
  memoryWriteBlocked: boolean;
  pathSafetyBlocked: boolean;
  pathSafetyCode?: string;
  rbacDenied: boolean;
  rbacReason?: string;
  egressBlocked: boolean;
  egressReason?: string;
  killSwitchActive: boolean;
  sessionBlocked: boolean;
  forensicSnapshotCaptured: boolean;
  securityTeamNotified: boolean;
  redactedOutput?: string;
  env: Record<string, string>;
};
