import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { pool } from '../../memory/db.js';
import { outreachStoreDir } from '../store.js';
import { emptyOutreachStore } from '../store-shape.js';
import type { OutreachStoreShape } from '../types.js';
import { saveWorkspaceOutreachToPg } from './hydrate.js';
import { withOutreachTx } from './tx.js';

export type MigrateJsonReport = {
  dryRun: boolean;
  sourcePath: string;
  sourceSha256: string;
  backupPath: string | null;
  workspaces: number;
  imported: Record<string, number>;
  skipped: Record<string, number>;
  duplicate: Record<string, number>;
  rejected: Array<{ entity: string; id?: string; reason: string }>;
  inconsistent: Array<{ entity: string; id?: string; reason: string }>;
};

function sha256File(filePath: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function collectWorkspaceIds(store: OutreachStoreShape): string[] {
  const ids = new Set<string>();
  for (const row of store.leads) ids.add(row.workspaceId);
  for (const row of store.campaigns) ids.add(row.workspaceId);
  for (const row of store.sequences) ids.add(row.workspaceId);
  for (const row of store.enrollments) ids.add(row.workspaceId);
  for (const row of store.deliveries) ids.add(row.workspaceId);
  for (const row of store.lists) ids.add(row.workspaceId);
  for (const row of store.replyReviews) ids.add(row.workspaceId);
  for (const row of store.bookings) ids.add(row.workspaceId);
  for (const row of store.reminders) ids.add(row.workspaceId);
  for (const row of store.followUpTasks) ids.add(row.workspaceId);
  for (const row of store.ingestJobs) ids.add(row.workspaceId);
  for (const row of store.leadViews) ids.add(row.workspaceId);
  for (const row of store.suppressions || []) ids.add(row.workspaceId);
  for (const key of Object.keys(store.controls)) ids.add(key);
  for (const key of Object.keys(store.alertTargets)) ids.add(key);
  for (const key of Object.keys(store.bookingConfigs)) ids.add(key);
  for (const key of Object.keys(store.boardConfigs)) ids.add(key);
  for (const sheet of Object.values(store.leadSheetConfigs)) ids.add(sheet.workspaceId);
  return [...ids].filter(Boolean);
}

function validateWorkspaceOwnership(store: OutreachStoreShape, report: MigrateJsonReport): void {
  const check = (entity: string, workspaceId: string | undefined, id?: string) => {
    if (!workspaceId || !String(workspaceId).trim()) {
      report.rejected.push({ entity, id, reason: 'missing workspaceId' });
    }
  };
  for (const lead of store.leads) check('lead', lead.workspaceId, lead.id);
  for (const e of store.enrollments) {
    check('enrollment', e.workspaceId, e.id);
    if (!store.leads.some((l) => l.id === e.leadId && l.workspaceId === e.workspaceId)) {
      report.inconsistent.push({
        entity: 'enrollment',
        id: e.id,
        reason: `lead ${e.leadId} missing in workspace ${e.workspaceId}`,
      });
    }
  }
  for (const d of store.deliveries) {
    check('delivery', d.workspaceId, d.id);
    if (!store.leads.some((l) => l.id === d.leadId && l.workspaceId === d.workspaceId)) {
      report.inconsistent.push({
        entity: 'delivery',
        id: d.id,
        reason: `lead ${d.leadId} missing in workspace ${d.workspaceId}`,
      });
    }
  }
}

function countEntities(store: OutreachStoreShape, workspaceId: string): Record<string, number> {
  return {
    leads: store.leads.filter((x) => x.workspaceId === workspaceId).length,
    campaigns: store.campaigns.filter((x) => x.workspaceId === workspaceId).length,
    sequences: store.sequences.filter((x) => x.workspaceId === workspaceId).length,
    enrollments: store.enrollments.filter((x) => x.workspaceId === workspaceId).length,
    deliveries: store.deliveries.filter((x) => x.workspaceId === workspaceId).length,
    lists: store.lists.filter((x) => x.workspaceId === workspaceId).length,
    replyReviews: store.replyReviews.filter((x) => x.workspaceId === workspaceId).length,
    bookings: store.bookings.filter((x) => x.workspaceId === workspaceId).length,
    reminders: store.reminders.filter((x) => x.workspaceId === workspaceId).length,
    followUpTasks: store.followUpTasks.filter((x) => x.workspaceId === workspaceId).length,
    suppressions: (store.suppressions || []).filter((x) => x.workspaceId === workspaceId).length,
    ingestJobs: store.ingestJobs.filter((x) => x.workspaceId === workspaceId).length,
    leadViews: store.leadViews.filter((x) => x.workspaceId === workspaceId).length,
  };
}

export async function migrateOutreachJsonToPostgres(opts: {
  sourcePath?: string;
  dryRun?: boolean;
  backupDir?: string;
}): Promise<MigrateJsonReport> {
  const sourcePath = opts.sourcePath || path.join(outreachStoreDir(), 'outreach-program.json');
  const dryRun = Boolean(opts.dryRun);
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source JSON not found: ${sourcePath}`);
  }

  const sourceSha256 = sha256File(sourcePath);
  const backupDir =
    opts.backupDir || path.join(outreachStoreDir(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(
    backupDir,
    `outreach-program.${new Date().toISOString().replace(/[:.]/g, '-')}.${sourceSha256.slice(0, 12)}.json`,
  );
  fs.copyFileSync(sourcePath, backupPath);

  const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as Partial<OutreachStoreShape>;
  const store: OutreachStoreShape = {
    ...emptyOutreachStore(),
    ...raw,
    leads: raw.leads ?? [],
    campaigns: raw.campaigns ?? [],
    sequences: raw.sequences ?? [],
    enrollments: raw.enrollments ?? [],
    deliveries: raw.deliveries ?? [],
    lists: raw.lists ?? [],
    replyReviews: raw.replyReviews ?? [],
    bookings: raw.bookings ?? [],
    reminders: raw.reminders ?? [],
    followUpTasks: raw.followUpTasks ?? [],
    bookingConfigs: raw.bookingConfigs ?? {},
    boardConfigs: raw.boardConfigs ?? {},
    boardRefs: raw.boardRefs ?? {},
    alertTargets: raw.alertTargets ?? {},
    controls: raw.controls ?? {},
    leadSheetConfigs: raw.leadSheetConfigs ?? {},
    ingestJobs: raw.ingestJobs ?? [],
    leadViews: raw.leadViews ?? [],
    suppressions: raw.suppressions ?? [],
  };

  const report: MigrateJsonReport = {
    dryRun,
    sourcePath,
    sourceSha256,
    backupPath,
    workspaces: 0,
    imported: {},
    skipped: {},
    duplicate: {},
    rejected: [],
    inconsistent: [],
  };

  validateWorkspaceOwnership(store, report);
  const workspaceIds = collectWorkspaceIds(store);
  report.workspaces = workspaceIds.length;

  const bump = (bag: Record<string, number>, key: string, n: number) => {
    bag[key] = (bag[key] || 0) + n;
  };

  for (const workspaceId of workspaceIds) {
    const counts = countEntities(store, workspaceId);
    if (dryRun) {
      for (const [k, v] of Object.entries(counts)) bump(report.imported, k, v);
      continue;
    }

    const existing = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c FROM outreach_leads WHERE workspace_id = $1`,
      [workspaceId],
    );
    const existingLeads = Number(existing.rows[0]?.c || 0);
    if (existingLeads > 0) {
      // Idempotent re-run: replace workspace slice (same IDs preserved via DELETE+INSERT).
      bump(report.duplicate, 'workspace_reimport', 1);
    }

    await saveWorkspaceOutreachToPg(workspaceId, store);
    for (const [k, v] of Object.entries(counts)) bump(report.imported, k, v);
  }

  // Mark JSON as read-only rollback artifact
  if (!dryRun) {
    const readonlyMarker = path.join(outreachStoreDir(), 'outreach-program.json.READONLY');
    fs.writeFileSync(
      readonlyMarker,
      JSON.stringify(
        {
          migratedAt: new Date().toISOString(),
          sourceSha256,
          backupPath,
          note: 'JSON is a rollback artifact. Production reads/writes use PostgreSQL when CARINA_OUTREACH_PERSISTENCE=postgres.',
        },
        null,
        2,
      ),
    );

    await withOutreachTx(async (client) => {
      await client.query(
        `INSERT INTO outreach_migration_runs (id, dry_run, source_path, source_sha256, backup_path, finished_at, report)
         VALUES ($1,$2,$3,$4,$5,NOW(),$6)`,
        [
          crypto.randomUUID(),
          false,
          sourcePath,
          sourceSha256,
          backupPath,
          JSON.stringify(report),
        ],
      );
      await client.query(
        `INSERT INTO outreach_meta (key, value, updated_at) VALUES ('json_migration', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [JSON.stringify({ sourceSha256, backupPath, migratedAt: new Date().toISOString() })],
      );
    });
  }

  return report;
}
