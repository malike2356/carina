export type {
  EvalGateMode,
  AssertionType,
  EvalAssertion,
  EvalFixture,
  EvalDefinition,
  EvalThresholds,
  EvalRunResult,
  EvalReport,
  EvalGateResult,
  BaselineComparison,
  BlindComparisonResult,
  RunEvalOptions,
  CompareEvalOptions,
} from './types.js';

export { extractEvalKeywords } from './keywords.js';
export { matchSkillsInMemory } from './match.js';
export {
  loadEvalDefinition,
  validateEvalDefinition,
  validateFixture,
  findEvalPathsForPack,
  scanForSensitive,
} from './fixtures.js';
export { evaluateAssertion, evaluateFixture, collectFailuresByType } from './assertions.js';
export { mean, stdDev, aggregateFixtureResults, checkThresholds, compareMetrics } from './aggregate.js';
export { runEval, runEvalWithBaseline, evalSkill } from './runner.js';
export {
  compareEvalDefinitions,
  blindCompare,
  compareBaselineCandidate,
  buildBaselineComparison,
} from './comparator.js';
export {
  saveReport,
  loadReport,
  listRecentReports,
  generateMarkdownReport,
  EVAL_REPORTS_DIR,
} from './report.js';
export { runPackEvalGate, resolveGateMode } from './gate.js';
export {
  deriveFixturesFromExamples,
  deriveFixturesFromSkills,
  buildEvalDefinitionFromPack,
  redactText,
} from './derive-fixtures.js';
export { runAuthoringLoop } from './authoring-loop.js';
