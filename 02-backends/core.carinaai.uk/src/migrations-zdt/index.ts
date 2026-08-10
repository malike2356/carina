export type {
  Dialect,
  SqlResult,
  SqlExecutor,
  ColumnSpec,
  MigrationStep,
  MigrationPlan,
  PreflightReport,
  ValidationReport,
  BackfillProgress,
  StagingMirrorPlan,
  SchemaDiff,
  ProductionGate,
} from './types.js';

export {
  DEFAULT_BATCH_SIZE,
  MAX_ACCEPTABLE_LOCK_MS,
  preflightActiveConnections,
  planAddColumnBeforeDrop,
  planRenameTableWithView,
  assertAddBeforeDropOrder,
  backfillInBatches,
  validateMigration,
  runMigrationPlan,
  addColumnBeforeDrop,
  renameTableWithView,
} from './zero-downtime-migration.js';

export {
  generateRollback,
  assertRollbackExists,
  rollbackTo,
  rollbackValidation,
} from './rollback-framework.js';

export {
  createStagingMirror,
  compareSchemas,
  runOnStagingFirst,
  productionConfirmationGate,
} from './staging-replica.js';

export {
  listPlans,
  getPlan,
  createAddBeforeDropPlan,
  stagingMirror,
  markStagingValidated,
  gateProduction,
} from './plan-store.js';

export { mountMigrationsZdtOpsRoutes } from './ops-routes.js';
