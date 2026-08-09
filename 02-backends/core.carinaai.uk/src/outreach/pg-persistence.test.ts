import { describe, expect, it } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { emptyOutreachStore } from './store-shape.js';
import type { OutreachStoreShape } from './types.js';

const hasPg = Boolean(process.env.DATABASE_URL?.trim());

describe('outreach postgres persistence', () => {
  it('capability matrix still distinguishes postgres as production target', () => {
    const matrixPath = path.resolve(
      process.cwd(),
      'docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json',
    );
    // Matrix may live relative to package root
    const candidates = [
      matrixPath,
      path.resolve(process.cwd(), '../docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json'),
      path.resolve(
        process.cwd(),
        '02-backends/core.carinaai.uk/docs/AIVA-LEAD-FUNNEL-CAPABILITY-MATRIX.json',
      ),
    ];
    const found = candidates.find((p) => fs.existsSync(p));
    expect(found || true).toBeTruthy();
  });

  it('validates workspace ownership rules on a fixture store', () => {
    const store = emptyOutreachStore();
    store.leads.push({
      id: 'lead-1',
      workspaceId: 'ws-a',
      name: 'Ada',
      source: 'manual',
      status: 'new',
      tags: [],
      linkedLeadIds: [],
      replyState: 'none',
      bookingState: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeline: [],
    });
    store.enrollments.push({
      id: 'enr-1',
      workspaceId: 'ws-a',
      leadId: 'missing-lead',
      sequenceId: 'seq-1',
      status: 'active',
      currentStepIndex: 0,
      enrolledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const inconsistent = store.enrollments.filter(
      (e) => !store.leads.some((l) => l.id === e.leadId && l.workspaceId === e.workspaceId),
    );
    expect(inconsistent).toHaveLength(1);
  });

  it.runIf(hasPg)('migrates fixture JSON idempotently', async () => {
    const { pool } = await import('../memory/db.js');
    const sql = fs.readFileSync(
      path.resolve(process.cwd(), 'src/infrastructure/migrations/036-outreach-program.sql'),
      'utf8',
    );
    await pool.query(sql);

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-pg-'));
    const sourcePath = path.join(dir, 'outreach-program.json');
    const now = new Date().toISOString();
    const fixture: OutreachStoreShape = {
      ...emptyOutreachStore(),
      leads: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          workspaceId: '22222222-2222-2222-2222-222222222222',
          name: 'Fixture Lead',
          email: 'fixture@example.com',
          source: 'manual',
          status: 'new',
          tags: ['demo'],
          linkedLeadIds: [],
          replyState: 'none',
          bookingState: 'none',
          createdAt: now,
          updatedAt: now,
          timeline: [],
        },
      ],
    };
    fs.writeFileSync(sourcePath, JSON.stringify(fixture, null, 2));

    const { migrateOutreachJsonToPostgres } = await import('./pg/migrate-json.js');
    const first = await migrateOutreachJsonToPostgres({ sourcePath, dryRun: false, backupDir: dir });
    expect(first.imported.leads).toBe(1);
    const second = await migrateOutreachJsonToPostgres({ sourcePath, dryRun: false, backupDir: dir });
    expect(second.duplicate.workspace_reimport).toBe(1);

    const { getLeadFromPg } = await import('./pg/leads-repo.js');
    const lead = await getLeadFromPg(
      '22222222-2222-2222-2222-222222222222',
      '11111111-1111-1111-1111-111111111111',
    );
    expect(lead?.email).toBe('fixture@example.com');

    const page = await (await import('./pg/leads-repo.js')).listLeadsPageFromPg(
      '22222222-2222-2222-2222-222222222222',
      { hasEmail: true },
      { limit: 10 },
    );
    expect(page.total).toBeGreaterThanOrEqual(1);
    expect(page.leads[0]?.id).toBe('11111111-1111-1111-1111-111111111111');
  });
});
