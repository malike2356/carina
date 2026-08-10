/**
 * Rollback scripts must exist before a migration runs.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { MigrationPlan } from './types.js';
import type { SqlExecutor } from './types.js';

export interface RollbackBundle {
  migrationName: string;
  rollbackPath: string;
  forwardPath: string;
  rollbackScript: string;
}

export function generateRollback(
  plan: MigrationPlan,
  migrationsDir: string,
): RollbackBundle {
  if (!plan.rollbackScript || !plan.rollbackScript.trim()) {
    throw new Error('Rollback script missing; refuse to proceed without rollback');
  }
  fs.mkdirSync(migrationsDir, { recursive: true });
  const forwardPath = path.join(migrationsDir, `${plan.name}.sql`);
  const rollbackPath = path.join(migrationsDir, `${plan.name}.rollback.sql`);
  fs.writeFileSync(
    forwardPath,
    `-- forward: ${plan.name}\n-- created: ${plan.createdAt}\n\n${plan.forwardScript}\n`,
  );
  fs.writeFileSync(
    rollbackPath,
    `-- rollback: ${plan.name}\n-- MUST exist before forward apply\n\n${plan.rollbackScript}\n`,
  );
  return {
    migrationName: plan.name,
    rollbackPath,
    forwardPath,
    rollbackScript: plan.rollbackScript,
  };
}

export function assertRollbackExists(migrationsDir: string, migrationName: string): string {
  const rollbackPath = path.join(migrationsDir, `${migrationName}.rollback.sql`);
  if (!fs.existsSync(rollbackPath)) {
    throw new Error(`Rollback required before run: missing ${rollbackPath}`);
  }
  return rollbackPath;
}

export async function rollbackTo(
  exec: SqlExecutor,
  migrationsDir: string,
  migrationName: string,
): Promise<{ applied: string[] }> {
  const rollbackPath = assertRollbackExists(migrationsDir, migrationName);
  const script = fs.readFileSync(rollbackPath, 'utf8');
  const statements = script
    .split(';')
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
  const applied: string[] = [];
  for (const stmt of statements) {
    await exec(stmt);
    applied.push(stmt.slice(0, 80));
  }
  return { applied };
}

export async function rollbackValidation(
  exec: SqlExecutor,
  checks: Array<{ sql: string; expectRowCount?: number; label: string }>,
): Promise<{ ok: boolean; failures: string[] }> {
  const failures: string[] = [];
  for (const check of checks) {
    const res = await exec(check.sql);
    if (typeof check.expectRowCount === 'number' && res.rowCount !== check.expectRowCount) {
      failures.push(`${check.label}: expected rowCount ${check.expectRowCount}, got ${res.rowCount}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
