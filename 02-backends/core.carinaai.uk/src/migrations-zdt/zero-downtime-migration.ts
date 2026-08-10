/**
 * Zero-downtime expand/contract migration engine (add before drop).
 */
import { randomUUID } from 'node:crypto';
import type {
  BackfillProgress,
  ColumnSpec,
  Dialect,
  MigrationPlan,
  MigrationStep,
  PreflightReport,
  SqlExecutor,
  ValidationReport,
} from './types.js';

export const DEFAULT_BATCH_SIZE = 1000;
export const MAX_ACCEPTABLE_LOCK_MS = 100;

function qIdent(dialect: Dialect, name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unsafe SQL identifier: ${name}`);
  }
  return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

function addColumnSql(dialect: Dialect, table: string, column: ColumnSpec): string {
  const t = qIdent(dialect, table);
  const c = qIdent(dialect, column.name);
  const nullSql = column.nullable === false ? ' NOT NULL' : '';
  const def = column.defaultSql ? ` DEFAULT ${column.defaultSql}` : '';
  if (dialect === 'postgres') {
    return `ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${c} ${column.typeSql}${nullSql}${def}`;
  }
  return `ALTER TABLE ${t} ADD COLUMN ${c} ${column.typeSql}${nullSql}${def}`;
}

function dropColumnSql(dialect: Dialect, table: string, column: string): string {
  const t = qIdent(dialect, table);
  const c = qIdent(dialect, column);
  if (dialect === 'postgres') {
    return `ALTER TABLE ${t} DROP COLUMN IF EXISTS ${c}`;
  }
  return `ALTER TABLE ${t} DROP COLUMN ${c}`;
}

export async function preflightActiveConnections(
  exec: SqlExecutor,
  dialect: Dialect,
  table: string,
): Promise<PreflightReport> {
  const warnings: string[] = [];
  let activeConnections = 0;
  if (dialect === 'postgres') {
    const res = await exec(
      `SELECT count(*)::int AS n FROM pg_stat_activity WHERE state = 'active' AND query ILIKE $1`,
      [`%${table}%`],
    );
    activeConnections = Number(res.rows[0]?.n || 0);
  } else {
    const res = await exec(
      `SELECT COUNT(*) AS n FROM information_schema.processlist WHERE INFO LIKE ?`,
      [`%${table}%`],
    );
    activeConnections = Number(res.rows[0]?.n || 0);
  }
  if (activeConnections > 0) {
    warnings.push(
      `Table ${table} has ${activeConnections} active connection(s); prefer low-traffic window`,
    );
  }
  return { ok: true, activeConnections, warnings };
}

export function planAddColumnBeforeDrop(opts: {
  name: string;
  table: string;
  newColumn: ColumnSpec;
  oldColumn: string;
  dialect?: Dialect;
  batchSize?: number;
}): MigrationPlan {
  const dialect = opts.dialect || 'postgres';
  const batchSize = opts.batchSize ?? DEFAULT_BATCH_SIZE;
  const t = qIdent(dialect, opts.table);
  const neu = qIdent(dialect, opts.newColumn.name);
  const old = qIdent(dialect, opts.oldColumn);
  const steps: MigrationStep[] = [
    {
      id: randomUUID(),
      kind: 'preflight',
      description: `Preflight active connections on ${opts.table}`,
      sql: `-- preflight:${opts.table}`,
      rollbackSql: '-- noop',
    },
    {
      id: randomUUID(),
      kind: 'add_column',
      description: `Add ${opts.newColumn.name} before touching ${opts.oldColumn}`,
      sql: addColumnSql(dialect, opts.table, opts.newColumn),
      rollbackSql: dropColumnSql(dialect, opts.table, opts.newColumn.name),
    },
    {
      id: randomUUID(),
      kind: 'backfill',
      description: `Backfill ${opts.newColumn.name} from ${opts.oldColumn} in batches of ${batchSize}`,
      sql:
        dialect === 'postgres'
          ? `UPDATE ${t} SET ${neu} = ${old} WHERE ${neu} IS DISTINCT FROM ${old} AND ctid IN (SELECT ctid FROM ${t} WHERE ${neu} IS DISTINCT FROM ${old} LIMIT ${batchSize})`
          : `UPDATE ${t} SET ${neu} = ${old} WHERE (${neu} IS NULL OR ${neu} <> ${old}) LIMIT ${batchSize}`,
      rollbackSql: `-- leave ${opts.newColumn.name}; app can ignore until drop`,
    },
    {
      id: randomUUID(),
      kind: 'validate',
      description: 'Validate new column matches old column',
      sql:
        dialect === 'postgres'
          ? `SELECT count(*)::int AS mismatches FROM ${t} WHERE ${neu} IS DISTINCT FROM ${old}`
          : `SELECT COUNT(*) AS mismatches FROM ${t} WHERE NOT (${neu} <=> ${old})`,
      rollbackSql: '-- noop',
    },
    {
      id: randomUUID(),
      kind: 'drop_column',
      description: `Drop ${opts.oldColumn} only after validation`,
      sql: dropColumnSql(dialect, opts.table, opts.oldColumn),
      rollbackSql: addColumnSql(dialect, opts.table, {
        name: opts.oldColumn,
        typeSql: opts.newColumn.typeSql,
        nullable: true,
      }),
    },
  ];

  assertAddBeforeDropOrder(steps);

  return finalizePlan(opts.name, dialect, steps);
}

export function planRenameTableWithView(opts: {
  name: string;
  table: string;
  newName: string;
  dialect?: Dialect;
}): MigrationPlan {
  const dialect = opts.dialect || 'postgres';
  const old = qIdent(dialect, opts.table);
  const neu = qIdent(dialect, opts.newName);
  const steps: MigrationStep[] = [
    {
      id: randomUUID(),
      kind: 'rename_table',
      description: `Rename ${opts.table} to ${opts.newName}`,
      sql: `ALTER TABLE ${old} RENAME TO ${neu}`,
      rollbackSql: `ALTER TABLE ${neu} RENAME TO ${old}`,
    },
    {
      id: randomUUID(),
      kind: 'create_view',
      description: `Create compatibility VIEW ${opts.table} -> ${opts.newName}`,
      sql:
        dialect === 'postgres'
          ? `CREATE OR REPLACE VIEW ${old} AS SELECT * FROM ${neu}`
          : `CREATE OR REPLACE VIEW ${old} AS SELECT * FROM ${neu}`,
      rollbackSql:
        dialect === 'postgres' ? `DROP VIEW IF EXISTS ${old}` : `DROP VIEW IF EXISTS ${old}`,
    },
  ];
  return finalizePlan(opts.name, dialect, steps);
}

export function assertAddBeforeDropOrder(steps: MigrationStep[]): void {
  const addIdx = steps.findIndex((s) => s.kind === 'add_column');
  const dropIdx = steps.findIndex((s) => s.kind === 'drop_column');
  if (dropIdx >= 0 && (addIdx < 0 || dropIdx < addIdx)) {
    throw new Error('Never drop a column before adding its replacement (add-before-drop rule)');
  }
  if (dropIdx >= 0) {
    const validateIdx = steps.findIndex((s) => s.kind === 'validate');
    if (validateIdx < 0 || validateIdx > dropIdx) {
      throw new Error('Must validate before dropping old column');
    }
  }
}

function finalizePlan(name: string, dialect: Dialect, steps: MigrationStep[]): MigrationPlan {
  const forwardScript = steps
    .filter((s) => !s.sql.startsWith('--'))
    .map((s) => `-- ${s.description}\n${s.sql};`)
    .join('\n\n');
  const rollbackScript = [...steps]
    .reverse()
    .filter((s) => s.rollbackSql && !s.rollbackSql.startsWith('--'))
    .map((s) => `-- rollback: ${s.description}\n${s.rollbackSql};`)
    .join('\n\n');
  if (!rollbackScript.trim()) {
    // still require a rollback artifact even if mostly noops
  }
  return {
    name,
    dialect,
    createdAt: new Date().toISOString(),
    steps,
    forwardScript,
    rollbackScript: rollbackScript || `-- rollback placeholder for ${name}\n`,
    requiresProductionConfirmation: true,
    stagingValidated: false,
  };
}

export async function backfillInBatches(
  exec: SqlExecutor,
  plan: MigrationPlan,
  opts?: { maxBatches?: number },
): Promise<BackfillProgress> {
  const step = plan.steps.find((s) => s.kind === 'backfill');
  if (!step) return { batches: 0, rowsUpdated: 0, done: true };
  const maxBatches = opts?.maxBatches ?? 10_000;
  let batches = 0;
  let rowsUpdated = 0;
  for (let i = 0; i < maxBatches; i++) {
    const res = await exec(step.sql);
    const lockMs = res.lockMs ?? 0;
    if (lockMs > MAX_ACCEPTABLE_LOCK_MS) {
      throw new Error(`Backfill lock ${lockMs}ms exceeded ${MAX_ACCEPTABLE_LOCK_MS}ms budget`);
    }
    batches += 1;
    rowsUpdated += res.rowCount;
    if (res.rowCount === 0) {
      return { batches, rowsUpdated, done: true };
    }
  }
  return { batches, rowsUpdated, done: false };
}

export async function validateMigration(
  exec: SqlExecutor,
  plan: MigrationPlan,
): Promise<ValidationReport> {
  const step = plan.steps.find((s) => s.kind === 'validate');
  if (!step) {
    return { ok: true, mismatches: 0, sample: [], message: 'No validate step' };
  }
  const res = await exec(step.sql);
  const mismatches = Number(res.rows[0]?.mismatches || 0);
  return {
    ok: mismatches === 0,
    mismatches,
    sample: res.rows.slice(0, 5),
    message: mismatches === 0 ? 'New column matches old column' : `${mismatches} mismatched row(s)`,
  };
}

export async function runMigrationPlan(
  exec: SqlExecutor,
  plan: MigrationPlan,
  opts?: {
    skipDrop?: boolean;
    /** Production runs require this exact token after staging validation. */
    productionConfirmToken?: string;
    environment?: 'staging' | 'production' | 'test';
  },
): Promise<{ executed: string[]; validation: ValidationReport; backfill: BackfillProgress }> {
  const env = opts?.environment || 'test';
  if (env === 'production') {
    if (!plan.stagingValidated) {
      throw new Error('Production migration blocked: staging validation has not passed');
    }
    if (opts?.productionConfirmToken !== `CONFIRM_PROD:${plan.name}`) {
      throw new Error(
        `Production migration requires explicit confirmation token CONFIRM_PROD:${plan.name}`,
      );
    }
  }

  const executed: string[] = [];
  for (const step of plan.steps) {
    if (step.kind === 'preflight') {
      const tableMatch = step.sql.match(/preflight:([A-Za-z0-9_]+)/);
      if (tableMatch) {
        const report = await preflightActiveConnections(exec, plan.dialect, tableMatch[1]);
        if (report.warnings.length) {
          // warnings do not block; callers can inspect
        }
      }
      executed.push(step.id);
      continue;
    }
    if (step.kind === 'backfill') {
      continue; // handled below as batched
    }
    if (step.kind === 'validate') {
      continue;
    }
    if (step.kind === 'drop_column') {
      // Drop only after backfill + validation succeed
      continue;
    }
    if (step.sql.startsWith('--')) {
      executed.push(step.id);
      continue;
    }
    const res = await exec(step.sql);
    if ((res.lockMs ?? 0) > MAX_ACCEPTABLE_LOCK_MS) {
      throw new Error(`Step ${step.kind} lock ${res.lockMs}ms exceeded ${MAX_ACCEPTABLE_LOCK_MS}ms`);
    }
    executed.push(step.id);
  }

  const backfill = await backfillInBatches(exec, plan);
  const validation = await validateMigration(exec, plan);
  if (!validation.ok) {
    throw new Error(`Validation failed: ${validation.message}`);
  }

  if (!opts?.skipDrop) {
    const drop = plan.steps.find((s) => s.kind === 'drop_column');
    if (drop && !drop.sql.startsWith('--')) {
      const res = await exec(drop.sql);
      if ((res.lockMs ?? 0) > MAX_ACCEPTABLE_LOCK_MS) {
        throw new Error(`drop_column lock ${res.lockMs}ms exceeded ${MAX_ACCEPTABLE_LOCK_MS}ms`);
      }
      executed.push(drop.id);
    }
  }

  return { executed, validation, backfill };
}

/** Alias matching the transcript wording. */
export const addColumnBeforeDrop = planAddColumnBeforeDrop;
export const renameTableWithView = planRenameTableWithView;
