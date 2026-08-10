/**
 * Staging-first workflow helpers (mirror plan + schema compare + gated run).
 */
import type {
  Dialect,
  MigrationPlan,
  ProductionGate,
  SchemaDiff,
  SqlExecutor,
  StagingMirrorPlan,
} from './types.js';
import { runMigrationPlan } from './zero-downtime-migration.js';
import { assertRollbackExists } from './rollback-framework.js';

export function createStagingMirror(opts: {
  sourceDatabase: string;
  stagingDatabase: string;
  dialect?: Dialect;
}): StagingMirrorPlan {
  const dialect = opts.dialect || 'postgres';
  const commands: string[] =
    dialect === 'postgres'
      ? [
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${opts.stagingDatabase}' AND pid <> pg_backend_pid()`,
          `DROP DATABASE IF EXISTS ${opts.stagingDatabase}`,
          `CREATE DATABASE ${opts.stagingDatabase} WITH TEMPLATE ${opts.sourceDatabase}`,
        ]
      : [
          `CREATE DATABASE IF NOT EXISTS ${opts.stagingDatabase}`,
          `mysqldump ${opts.sourceDatabase} | mysql ${opts.stagingDatabase}`,
        ];
  return {
    sourceDatabase: opts.sourceDatabase,
    stagingDatabase: opts.stagingDatabase,
    dialect,
    commands,
    estimatedMinutesNote:
      'Target: complete mirror under 5 minutes for databases up to 10GB when using TEMPLATE or streamed dump on same host.',
  };
}

export async function compareSchemas(
  leftExec: SqlExecutor,
  rightExec: SqlExecutor,
  dialect: Dialect = 'postgres',
): Promise<SchemaDiff> {
  const sql =
    dialect === 'postgres'
      ? `SELECT table_name || '.' || column_name || ':' || data_type AS item
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY 1`
      : `SELECT CONCAT(table_name, '.', column_name, ':', data_type) AS item
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
         ORDER BY 1`;
  const left = await leftExec(sql);
  const right = await rightExec(sql);
  const leftSet = new Set(left.rows.map((r) => String(r.item)));
  const rightSet = new Set(right.rows.map((r) => String(r.item)));
  const onlyInLeft = [...leftSet].filter((x) => !rightSet.has(x)).sort();
  const onlyInRight = [...rightSet].filter((x) => !leftSet.has(x)).sort();
  return { onlyInLeft, onlyInRight, identical: onlyInLeft.length === 0 && onlyInRight.length === 0 };
}

export async function runOnStagingFirst(
  stagingExec: SqlExecutor,
  plan: MigrationPlan,
  opts: { migrationsDir: string },
): Promise<{ plan: MigrationPlan; report: Awaited<ReturnType<typeof runMigrationPlan>> }> {
  assertRollbackExists(opts.migrationsDir, plan.name);
  const report = await runMigrationPlan(stagingExec, plan, { environment: 'staging' });
  plan.stagingValidated = true;
  return { plan, report };
}

export function productionConfirmationGate(
  plan: MigrationPlan,
  confirmToken?: string,
): ProductionGate {
  if (!plan.stagingValidated) {
    return { allowed: false, reason: 'Staging validation has not passed' };
  }
  if (confirmToken !== `CONFIRM_PROD:${plan.name}`) {
    return {
      allowed: false,
      reason: `Provide explicit confirmation token CONFIRM_PROD:${plan.name} after staging passes`,
    };
  }
  return { allowed: true, reason: 'Staging validated and confirmation provided' };
}
