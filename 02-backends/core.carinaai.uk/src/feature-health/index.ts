export {
  registerFeature,
  getAllFeatures,
  getFeature,
  updateFeatureHealth,
  clearFeatureRegistry,
  trafficLight,
  type FeatureStatus,
  type FeatureHealth,
  type FeatureDefinition,
  type RegisteredFeature,
} from './feature-registry.js';

export {
  checkFeatureHealth,
  checkAllFeatures,
  deriveStatus,
  type SmokeResult,
  type UsageMetrics,
  type HealthCheckDeps,
} from './health-checker.js';

export {
  prioritizeFixes,
  generateFixQueue,
  type FixPriority,
  type FixQueueItem,
} from './prioritization-engine.js';

export {
  canBuildNewFeature,
  getBlockingIssues,
  evaluateBuildGate,
  scheduleWeeklyAudit,
  type BuildGateResult,
  type WeeklyAuditHandle,
} from './build-gate.js';
