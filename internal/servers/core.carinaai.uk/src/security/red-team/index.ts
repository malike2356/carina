export {
  redTeamAutomation,
  RedTeamAutomation,
  buildLatestReport,
  buildScheduleView,
  formatRedTeamReport,
  formatRedTeamResult,
  formatRedTeamSchedule,
  isRedTeamEnabled,
  listUnresolvedGaps,
  shouldBlockRedTeamGaps,
} from './automation.js';
export {
  DEFAULT_RED_TEAM_EXERCISES,
  describeScheduleHint,
  getExerciseById,
  listExerciseIds,
} from './exercises.js';
export {
  executeAttack,
  resetRedTeamAttackRuntime,
  summarizeRaspCorrelation,
} from './attacks.js';
export {
  appendResult,
  loadExercises,
  readResults,
  _resetRedTeamStoreForTests,
} from './store.js';
export {
  createDetectionRule,
  listDetectionRules,
  _resetRedTeamRulesForTests,
} from './rules-store.js';
export type {
  AttackExecution,
  DetectionRule,
  RedTeamAttackType,
  RedTeamExercise,
  RedTeamReport,
  RedTeamResult,
  RedTeamScheduleEntry,
  SecurityGap,
  SecurityGapSeverity,
} from './types.js';
