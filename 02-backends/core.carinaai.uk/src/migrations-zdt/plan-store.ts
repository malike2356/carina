import type { MigrationPlan, StagingMirrorPlan } from './types.js';
import { planAddColumnBeforeDrop } from './zero-downtime-migration.js';
import { generateRollback } from './rollback-framework.js';
import { createStagingMirror, productionConfirmationGate } from './staging-replica.js';
import type { ColumnSpec, Dialect } from './types.js';
import path from 'node:path';

const plans = new Map<string, MigrationPlan>();

export function listPlans(): MigrationPlan[] {
  return [...plans.values()];
}

export function getPlan(name: string): MigrationPlan | undefined {
  return plans.get(name);
}

export function createAddBeforeDropPlan(opts: {
  name: string;
  table: string;
  oldColumn: string;
  newColumn: ColumnSpec;
  dialect?: Dialect;
  artifactsDir?: string;
}): { plan: MigrationPlan; artifacts: ReturnType<typeof generateRollback> } {
  const plan = planAddColumnBeforeDrop({
    name: opts.name,
    table: opts.table,
    oldColumn: opts.oldColumn,
    newColumn: opts.newColumn,
    dialect: opts.dialect || 'postgres',
  });
  const dir =
    opts.artifactsDir ||
    path.join(process.cwd(), 'src', 'infrastructure', 'migrations', 'zdt-artifacts');
  const artifacts = generateRollback(plan, dir);
  plans.set(plan.name, plan);
  return { plan, artifacts };
}

export function stagingMirror(
  sourceDatabase: string,
  stagingDatabase: string,
  dialect: Dialect = 'postgres',
): StagingMirrorPlan {
  return createStagingMirror({ sourceDatabase, stagingDatabase, dialect });
}

export function markStagingValidated(name: string): MigrationPlan {
  const plan = plans.get(name);
  if (!plan) throw new Error(`Plan not found: ${name}`);
  plan.stagingValidated = true;
  plans.set(name, plan);
  return plan;
}

export function gateProduction(name: string, confirmToken: string) {
  const plan = plans.get(name);
  if (!plan) throw new Error(`Plan not found: ${name}`);
  return { plan, gate: productionConfirmationGate(plan, confirmToken) };
}
