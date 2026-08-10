/** Zero-downtime migration types. */

export type Dialect = 'postgres' | 'mysql';

export interface SqlResult {
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  /** Simulated lock duration for tests / telemetry. */
  lockMs?: number;
}

export type SqlExecutor = (sql: string, params?: unknown[]) => Promise<SqlResult>;

export interface ColumnSpec {
  name: string;
  /** SQL type fragment, e.g. TEXT, VARCHAR(255), INTEGER */
  typeSql: string;
  nullable?: boolean;
  defaultSql?: string;
}

export interface MigrationStep {
  id: string;
  kind:
    | 'preflight'
    | 'add_column'
    | 'backfill'
    | 'validate'
    | 'drop_column'
    | 'rename_table'
    | 'create_view'
    | 'drop_view'
    | 'custom';
  sql: string;
  rollbackSql: string;
  description: string;
}

export interface MigrationPlan {
  name: string;
  dialect: Dialect;
  createdAt: string;
  steps: MigrationStep[];
  rollbackScript: string;
  forwardScript: string;
  requiresProductionConfirmation: boolean;
  stagingValidated: boolean;
}

export interface PreflightReport {
  ok: boolean;
  activeConnections: number;
  warnings: string[];
}

export interface ValidationReport {
  ok: boolean;
  mismatches: number;
  sample: Array<Record<string, unknown>>;
  message: string;
}

export interface BackfillProgress {
  batches: number;
  rowsUpdated: number;
  done: boolean;
}

export interface StagingMirrorPlan {
  sourceDatabase: string;
  stagingDatabase: string;
  dialect: Dialect;
  commands: string[];
  estimatedMinutesNote: string;
}

export interface SchemaDiff {
  onlyInLeft: string[];
  onlyInRight: string[];
  identical: boolean;
}

export interface ProductionGate {
  allowed: boolean;
  reason: string;
}
