export {
  runFullAudit,
  listLayerIds,
} from './production-audit.js';

export {
  generateFix,
  generateFixesForReport,
  fixTemplateCoverage,
} from './fix-generator.js';

export {
  runPipeline,
  pipelineStatus,
  type PipelineResult,
} from './pipeline-runner.js';

export type {
  Severity,
  Finding,
  LayerId,
  LayerResult,
  AuditReport,
  FixProposal,
  PipelineStatus,
  AuditContext,
} from './types.js';

export {
  DEFAULT_THRESHOLD,
  CRITICAL_LAYER_IDS,
  createAuditContext,
} from './types.js';
