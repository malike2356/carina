/**
 * Integration: staging migrate → validate → rollback → identity.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  planAddColumnBeforeDrop,
  assertAddBeforeDropOrder,
  generateRollback,
  runOnStagingFirst,
  rollbackTo,
  compareSchemas,
  productionConfirmationGate,
  runMigrationPlan,
  createStagingMirror,
  DEFAULT_BATCH_SIZE,
} from './index.js';
import type { SqlExecutor, SqlResult } from './types.js';

type Row = Record<string, unknown>;

function createMemoryDb(): { exec: SqlExecutor; dumpSchema: () => string[]; rows: () => Row[] } {
  const columns = new Set(['id', 'email_old']);
  const table: Row[] = [
    { id: 1, email_old: 'a@example.com' },
    { id: 2, email_old: 'b@example.com' },
    { id: 3, email_old: 'c@example.com' },
  ];

  const exec: SqlExecutor = async (sql: string): Promise<SqlResult> => {
    const normalized = sql.replace(/\s+/g, ' ').trim();
    if (/pg_stat_activity|processlist/i.test(normalized)) {
      return { rows: [{ n: 0 }], rowCount: 1, lockMs: 1 };
    }
    if (/ADD COLUMN/i.test(normalized)) {
      const m = normalized.match(/ADD COLUMN(?: IF NOT EXISTS)? "?([A-Za-z0-9_]+)"?/i);
      if (m) {
        columns.add(m[1]);
        for (const row of table) {
          if (!(m[1] in row)) {
            row[m[1]] = m[1] === 'email_old' ? row.email_new ?? null : null;
          }
        }
      }
      return { rows: [], rowCount: 0, lockMs: 5 };
    }
    if (/UPDATE .* SET "email_new" = "email_old"/i.test(normalized) || /SET `email_new` = `email_old`/i.test(normalized) || /SET "email_new" = "email_old"/i.test(normalized)) {
      let updated = 0;
      for (const row of table) {
        if (row.email_new !== row.email_old) {
          row.email_new = row.email_old;
          updated += 1;
          if (updated >= DEFAULT_BATCH_SIZE) break;
        }
      }
      // small table: update remaining in one go
      if (updated === 0) {
        for (const row of table) {
          if (row.email_new !== row.email_old) {
            row.email_new = row.email_old;
            updated += 1;
          }
        }
      }
      return { rows: [], rowCount: updated, lockMs: 8 };
    }
    if (/mismatches/i.test(normalized)) {
      const mismatches = table.filter((r) => r.email_new !== r.email_old).length;
      return { rows: [{ mismatches }], rowCount: 1, lockMs: 2 };
    }
    if (/DROP COLUMN/i.test(normalized)) {
      const dropNew = /email_new/i.test(normalized);
      const dropOld = /email_old/i.test(normalized);
      if (dropNew) {
        columns.delete('email_new');
        for (const row of table) delete row.email_new;
      }
      if (dropOld) {
        columns.delete('email_old');
        for (const row of table) delete row.email_old;
      }
      return { rows: [], rowCount: 0, lockMs: 6 };
    }
    if (/information_schema\.columns/i.test(normalized)) {
      const items = [...columns].sort().map((c) => ({ item: `users.${c}:text` }));
      return { rows: items, rowCount: items.length, lockMs: 1 };
    }
    return { rows: [], rowCount: 0, lockMs: 1 };
  };

  return {
    exec,
    dumpSchema: () => [...columns].sort(),
    rows: () => table.map((r) => ({ ...r })),
  };
}

describe('zero-downtime migrations', () => {
  it('rejects drop-before-add plans', () => {
    expect(() =>
      assertAddBeforeDropOrder([
        {
          id: '1',
          kind: 'drop_column',
          sql: 'DROP',
          rollbackSql: 'ADD',
          description: 'bad',
        },
        {
          id: '2',
          kind: 'add_column',
          sql: 'ADD',
          rollbackSql: 'DROP',
          description: 'late',
        },
      ]),
    ).toThrow(/add-before-drop/i);
  });

  it('staging migrate → validate → rollback → schema identity', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zdt-'));
    const staging = createMemoryDb();
    const baselineSchema = staging.dumpSchema();

    const plan = planAddColumnBeforeDrop({
      name: 'users_email_rename_zdt',
      table: 'users',
      oldColumn: 'email_old',
      newColumn: { name: 'email_new', typeSql: 'TEXT', nullable: true },
      dialect: 'postgres',
      batchSize: 1000,
    });

    const bundle = generateRollback(plan, dir);
    expect(fs.existsSync(bundle.rollbackPath)).toBe(true);
    expect(fs.existsSync(bundle.forwardPath)).toBe(true);

    const mirror = createStagingMirror({
      sourceDatabase: 'carina',
      stagingDatabase: 'carina_staging',
    });
    expect(mirror.commands.some((c) => /TEMPLATE|mysqldump/i.test(c))).toBe(true);

    const { plan: validated, report } = await runOnStagingFirst(staging.exec, plan, {
      migrationsDir: dir,
    });
    expect(validated.stagingValidated).toBe(true);
    expect(report.validation.ok).toBe(true);
    expect(report.backfill.done).toBe(true);
    expect(staging.dumpSchema()).toContain('email_new');
    expect(staging.dumpSchema()).not.toContain('email_old');

    // Production blocked without confirm
    const gate = productionConfirmationGate(validated);
    expect(gate.allowed).toBe(false);

    await expect(
      runMigrationPlan(staging.exec, validated, { environment: 'production' }),
    ).rejects.toThrow(/CONFIRM_PROD/);

    // Rollback restores old column presence for this plan's reverse steps
    await rollbackTo(staging.exec, dir, plan.name);
    // After rollback of drop: email_old re-added; email_new may remain depending on reverse order.
    // Validate via schema compare against a fresh baseline DB that still has email_old only:
    const prodLike = createMemoryDb();
    // Re-run forward on a second staging copy then rollback to prove identity with untouched prod-like
    const staging2 = createMemoryDb();
    const plan2 = planAddColumnBeforeDrop({
      name: 'users_email_rename_zdt2',
      table: 'users',
      oldColumn: 'email_old',
      newColumn: { name: 'email_new', typeSql: 'TEXT', nullable: true },
    });
    generateRollback(plan2, dir);
    await runOnStagingFirst(staging2.exec, plan2, { migrationsDir: dir });
    await rollbackTo(staging2.exec, dir, plan2.name);
    // Re-add path restores email_old; drop rollback for email_new removes it if executed
    // Our rollback script order: reverse steps → add email_old, then drop email_new
    const diff = await compareSchemas(prodLike.exec, staging2.exec);
    expect(diff.identical).toBe(true);
    expect(baselineSchema).toEqual(['email_old', 'id']);
  });
});
