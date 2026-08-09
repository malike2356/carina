import type { PoolClient } from 'pg';
import { pool } from '../../memory/db.js';
import type {
  FollowUpTask,
  LeadIngestJob,
  LeadList,
  LeadSavedView,
  OutreachBooking,
  OutreachCampaign,
  OutreachControlState,
  OutreachLead,
  OutreachReminder,
  OutreachSequence,
  OutreachStoreShape,
  ReplyReview,
  SequenceEnrollment,
  DeliveryEvent,
  LeadSheetConfig,
  OutreachAlertTarget,
  OutreachBoardConfig,
  OutreachBoardRef,
  BookingConfig,
} from '../types.js';
import { emptyOutreachStore } from '../store-shape.js';
import { lockOutreachWorkspace, withOutreachTx } from './tx.js';

type Suppression = NonNullable<OutreachStoreShape['suppressions']>[number];

function asPayload<T>(row: { payload: unknown }): T {
  return row.payload as T;
}

async function loadArray<T>(
  client: PoolClient,
  table: string,
  workspaceId?: string,
): Promise<T[]> {
  if (workspaceId) {
    const res = await client.query(`SELECT payload FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
    return res.rows.map((r) => asPayload<T>(r));
  }
  const res = await client.query(`SELECT payload FROM ${table}`);
  return res.rows.map((r) => asPayload<T>(r));
}

async function loadMapByWorkspace<T extends { workspaceId: string }>(
  client: PoolClient,
  table: string,
  workspaceId?: string,
): Promise<Record<string, T>> {
  const rows = await loadArray<T>(client, table, workspaceId);
  const out: Record<string, T> = {};
  for (const row of rows) out[row.workspaceId] = row;
  return out;
}

export async function loadOutreachStoreFromPg(workspaceId?: string): Promise<OutreachStoreShape> {
  const client = await pool.connect();
  try {
    const store = emptyOutreachStore();
    store.leads = await loadArray<OutreachLead>(client, 'outreach_leads', workspaceId);
    store.campaigns = await loadArray<OutreachCampaign>(client, 'outreach_campaigns', workspaceId);
    store.sequences = await loadArray<OutreachSequence>(client, 'outreach_sequences', workspaceId);
    store.enrollments = await loadArray<SequenceEnrollment>(client, 'outreach_enrollments', workspaceId);
    store.deliveries = await loadArray<DeliveryEvent>(client, 'outreach_deliveries', workspaceId);
    store.lists = await loadArray<LeadList>(client, 'outreach_lists', workspaceId);
    store.replyReviews = await loadArray<ReplyReview>(client, 'outreach_reply_reviews', workspaceId);
    store.bookings = await loadArray<OutreachBooking>(client, 'outreach_bookings', workspaceId);
    store.reminders = await loadArray<OutreachReminder>(client, 'outreach_reminders', workspaceId);
    store.followUpTasks = await loadArray<FollowUpTask>(client, 'outreach_follow_up_tasks', workspaceId);
    store.ingestJobs = await loadArray<LeadIngestJob>(client, 'outreach_ingest_jobs', workspaceId);
    store.leadViews = await loadArray<LeadSavedView>(client, 'outreach_lead_views', workspaceId);
    store.suppressions = await loadArray<Suppression>(client, 'outreach_suppressions', workspaceId);

    store.controls = await loadMapByWorkspace<OutreachControlState>(client, 'outreach_controls', workspaceId);
    store.alertTargets = await loadMapByWorkspace<OutreachAlertTarget>(client, 'outreach_alert_targets', workspaceId);
    store.bookingConfigs = await loadMapByWorkspace<BookingConfig & { workspaceId?: string }>(
      client,
      'outreach_booking_configs',
      workspaceId,
    ) as OutreachStoreShape['bookingConfigs'];
    // booking configs are keyed by workspaceId but payload may not include workspaceId
    if (workspaceId) {
      const cfg = await client.query(`SELECT payload FROM outreach_booking_configs WHERE workspace_id = $1`, [
        workspaceId,
      ]);
      store.bookingConfigs = {};
      if (cfg.rows[0]) store.bookingConfigs[workspaceId] = asPayload<BookingConfig>(cfg.rows[0]);
    } else {
      const cfg = await client.query(`SELECT workspace_id, payload FROM outreach_booking_configs`);
      store.bookingConfigs = {};
      for (const row of cfg.rows) {
        store.bookingConfigs[row.workspace_id as string] = asPayload<BookingConfig>(row);
      }
    }

    const boardCfg = await client.query(
      workspaceId
        ? `SELECT workspace_id, payload FROM outreach_board_configs WHERE workspace_id = $1`
        : `SELECT workspace_id, payload FROM outreach_board_configs`,
      workspaceId ? [workspaceId] : [],
    );
    store.boardConfigs = {};
    for (const row of boardCfg.rows) {
      store.boardConfigs[row.workspace_id as string] = asPayload<OutreachBoardConfig>(row);
    }

    const boardRefs = await client.query(
      workspaceId
        ? `SELECT lead_id, payload FROM outreach_board_refs WHERE workspace_id = $1`
        : `SELECT lead_id, payload FROM outreach_board_refs`,
      workspaceId ? [workspaceId] : [],
    );
    store.boardRefs = {};
    for (const row of boardRefs.rows) {
      store.boardRefs[row.lead_id as string] = asPayload<OutreachBoardRef>(row);
    }

    const sheets = await loadArray<LeadSheetConfig>(client, 'outreach_lead_sheet_configs', workspaceId);
    store.leadSheetConfigs = {};
    for (const sheet of sheets) store.leadSheetConfigs[sheet.id] = sheet;

    return store;
  } finally {
    client.release();
  }
}

async function replaceWorkspaceRows(
  client: PoolClient,
  workspaceId: string,
  table: string,
  rows: Array<{ id: string; sql: string; params: unknown[] }>,
): Promise<void> {
  await client.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
  for (const row of rows) {
    await client.query(row.sql, row.params);
  }
}

function leadIndex(lead: OutreachLead) {
  return {
    email: lead.email || null,
    status: lead.status,
    pipeline_stage: lead.pipelineStage || lead.status || null,
    source: lead.sourceType || lead.source || null,
    company: lead.company || null,
    niche: lead.niche || null,
    town_city: lead.townCity || null,
    priority: lead.priority != null ? String(lead.priority) : null,
    has_email: Boolean(lead.email),
    replied: lead.replyState === 'replied' || Boolean(lead.lastReplyAt),
    next_action_at: lead.nextActionAt || null,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

export async function saveWorkspaceOutreachToPg(
  workspaceId: string,
  store: OutreachStoreShape,
): Promise<void> {
  await withOutreachTx(async (client) => {
    await lockOutreachWorkspace(client, workspaceId);

    const leads = store.leads.filter((l) => l.workspaceId === workspaceId);
    await client.query(`DELETE FROM outreach_leads WHERE workspace_id = $1`, [workspaceId]);
    for (const lead of leads) {
      const idx = leadIndex(lead);
      await client.query(
        `INSERT INTO outreach_leads (
          id, workspace_id, email, status, pipeline_stage, source, company, niche, town_city,
          priority, has_email, replied, next_action_at, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          lead.id,
          workspaceId,
          idx.email,
          idx.status,
          idx.pipeline_stage,
          idx.source,
          idx.company,
          idx.niche,
          idx.town_city,
          idx.priority,
          idx.has_email,
          idx.replied,
          idx.next_action_at,
          idx.created_at,
          idx.updated_at,
          JSON.stringify(lead),
        ],
      );
    }

    const upsertSimple = async (
      table: string,
      items: Array<{ id: string; workspaceId: string; createdAt?: string; updatedAt?: string; active?: boolean; status?: string; payload: unknown } & Record<string, unknown>>,
      build: (item: (typeof items)[number]) => { sql: string; params: unknown[] },
    ) => {
      await client.query(`DELETE FROM ${table} WHERE workspace_id = $1`, [workspaceId]);
      for (const item of items.filter((i) => i.workspaceId === workspaceId)) {
        const row = build(item);
        await client.query(row.sql, row.params);
      }
    };

    await upsertSimple(
      'outreach_campaigns',
      store.campaigns.map((c) => ({ ...c, payload: c })),
      (c) => ({
        sql: `INSERT INTO outreach_campaigns (id, workspace_id, active, created_at, updated_at, payload)
              VALUES ($1,$2,$3,$4,$5,$6)`,
        params: [c.id, workspaceId, Boolean((c as OutreachCampaign).active), c.createdAt, c.updatedAt, JSON.stringify(c)],
      }),
    );

    await upsertSimple(
      'outreach_sequences',
      store.sequences.map((s) => ({ ...s, payload: s })),
      (s) => ({
        sql: `INSERT INTO outreach_sequences (id, workspace_id, created_at, updated_at, payload) VALUES ($1,$2,$3,$4,$5)`,
        params: [s.id, workspaceId, s.createdAt, s.updatedAt, JSON.stringify(s)],
      }),
    );

    await client.query(`DELETE FROM outreach_enrollments WHERE workspace_id = $1`, [workspaceId]);
    for (const e of store.enrollments.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_enrollments (
          id, workspace_id, lead_id, sequence_id, campaign_id, status, next_action_at, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          e.id,
          workspaceId,
          e.leadId,
          e.sequenceId,
          e.campaignId || null,
          e.status,
          e.nextActionAt || null,
          e.enrolledAt,
          e.updatedAt,
          JSON.stringify(e),
        ],
      );
    }

    await client.query(`DELETE FROM outreach_deliveries WHERE workspace_id = $1`, [workspaceId]);
    for (const d of store.deliveries.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_deliveries (
          id, workspace_id, enrollment_id, lead_id, approval_id, status, scheduled_for, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          d.id,
          workspaceId,
          d.enrollmentId,
          d.leadId,
          d.approvalId || null,
          d.status,
          d.scheduledFor,
          d.createdAt,
          d.updatedAt,
          JSON.stringify(d),
        ],
      );
    }

    await client.query(`DELETE FROM outreach_list_members WHERE workspace_id = $1`, [workspaceId]);
    await client.query(`DELETE FROM outreach_lists WHERE workspace_id = $1`, [workspaceId]);
    for (const list of store.lists.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_lists (id, workspace_id, created_at, updated_at, payload) VALUES ($1,$2,$3,$4,$5)`,
        [list.id, workspaceId, list.createdAt, list.updatedAt, JSON.stringify(list)],
      );
      for (const leadId of list.leadIds || []) {
        await client.query(
          `INSERT INTO outreach_list_members (workspace_id, list_id, lead_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
          [workspaceId, list.id, leadId],
        );
      }
    }

    await client.query(`DELETE FROM outreach_reply_reviews WHERE workspace_id = $1`, [workspaceId]);
    for (const r of store.replyReviews.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_reply_reviews (
          id, workspace_id, lead_id, fingerprint, status, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [r.id, workspaceId, r.leadId, r.fingerprint, r.status, r.createdAt, r.updatedAt, JSON.stringify(r)],
      );
    }

    await client.query(`DELETE FROM outreach_suppressions WHERE workspace_id = $1`, [workspaceId]);
    for (const s of (store.suppressions || []).filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_suppressions (workspace_id, email, email_normalized, reason, lead_id, created_at, updated_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          workspaceId,
          s.email,
          s.email.trim().toLowerCase(),
          s.reason,
          s.leadId || null,
          s.createdAt,
          s.updatedAt || s.createdAt,
          JSON.stringify(s),
        ],
      );
    }

    await client.query(`DELETE FROM outreach_bookings WHERE workspace_id = $1`, [workspaceId]);
    for (const b of store.bookings.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_bookings (
          id, workspace_id, lead_id, status, starts_at, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [b.id, workspaceId, b.leadId, b.status, b.startsAt, b.createdAt, b.updatedAt, JSON.stringify(b)],
      );
    }

    await client.query(`DELETE FROM outreach_reminders WHERE workspace_id = $1`, [workspaceId]);
    for (const r of store.reminders.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_reminders (
          id, workspace_id, booking_id, lead_id, status, due_at, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          r.id,
          workspaceId,
          r.bookingId,
          r.leadId,
          r.status,
          r.dueAt,
          r.createdAt,
          r.updatedAt,
          JSON.stringify(r),
        ],
      );
    }

    await client.query(`DELETE FROM outreach_follow_up_tasks WHERE workspace_id = $1`, [workspaceId]);
    for (const t of store.followUpTasks.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_follow_up_tasks (
          id, workspace_id, lead_id, status, due_at, created_at, updated_at, payload
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [t.id, workspaceId, t.leadId, t.status, t.dueAt, t.createdAt, t.updatedAt, JSON.stringify(t)],
      );
    }

    await client.query(`DELETE FROM outreach_lead_views WHERE workspace_id = $1`, [workspaceId]);
    for (const v of store.leadViews.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_lead_views (id, workspace_id, name, created_at, updated_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [v.id, workspaceId, v.name, v.createdAt, v.updatedAt, JSON.stringify(v)],
      );
    }

    await client.query(`DELETE FROM outreach_ingest_jobs WHERE workspace_id = $1`, [workspaceId]);
    for (const j of store.ingestJobs.filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_ingest_jobs (id, workspace_id, kind, status, created_at, updated_at, payload)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [j.id, workspaceId, j.kind, j.status, j.createdAt, j.updatedAt, JSON.stringify(j)],
      );
    }

    await client.query(`DELETE FROM outreach_lead_sheet_configs WHERE workspace_id = $1`, [workspaceId]);
    for (const sheet of Object.values(store.leadSheetConfigs).filter((x) => x.workspaceId === workspaceId)) {
      await client.query(
        `INSERT INTO outreach_lead_sheet_configs (id, workspace_id, updated_at, payload) VALUES ($1,$2,$3,$4)`,
        [sheet.id, workspaceId, sheet.updatedAt, JSON.stringify(sheet)],
      );
    }

    const control = store.controls[workspaceId];
    await client.query(`DELETE FROM outreach_controls WHERE workspace_id = $1`, [workspaceId]);
    if (control) {
      await client.query(
        `INSERT INTO outreach_controls (workspace_id, paused, updated_at, payload) VALUES ($1,$2,$3,$4)`,
        [workspaceId, Boolean(control.paused), control.updatedAt, JSON.stringify(control)],
      );
    }

    const alert = store.alertTargets[workspaceId];
    await client.query(`DELETE FROM outreach_alert_targets WHERE workspace_id = $1`, [workspaceId]);
    if (alert) {
      await client.query(
        `INSERT INTO outreach_alert_targets (workspace_id, updated_at, payload) VALUES ($1,$2,$3)`,
        [workspaceId, alert.updatedAt, JSON.stringify(alert)],
      );
    }

    const bookingCfg = store.bookingConfigs[workspaceId];
    await client.query(`DELETE FROM outreach_booking_configs WHERE workspace_id = $1`, [workspaceId]);
    if (bookingCfg) {
      await client.query(
        `INSERT INTO outreach_booking_configs (workspace_id, updated_at, payload) VALUES ($1, NOW(), $2)`,
        [workspaceId, JSON.stringify(bookingCfg)],
      );
    }

    const boardCfg = store.boardConfigs[workspaceId];
    await client.query(`DELETE FROM outreach_board_configs WHERE workspace_id = $1`, [workspaceId]);
    if (boardCfg) {
      await client.query(
        `INSERT INTO outreach_board_configs (workspace_id, updated_at, payload) VALUES ($1, NOW(), $2)`,
        [workspaceId, JSON.stringify(boardCfg)],
      );
    }

    await client.query(`DELETE FROM outreach_board_refs WHERE workspace_id = $1`, [workspaceId]);
    const workspaceLeadIds = new Set(leads.map((l) => l.id));
    for (const [leadId, ref] of Object.entries(store.boardRefs)) {
      if (!workspaceLeadIds.has(leadId)) continue;
      await client.query(
        `INSERT INTO outreach_board_refs (workspace_id, lead_id, updated_at, payload) VALUES ($1,$2,$3,$4)`,
        [workspaceId, leadId, ref.updatedAt || new Date().toISOString(), JSON.stringify(ref)],
      );
    }
  });
}

export async function listWorkspaceIdsFromPg(): Promise<string[]> {
  const res = await pool.query<{ workspace_id: string }>(`
    SELECT workspace_id FROM outreach_enrollments
    UNION SELECT workspace_id FROM outreach_reminders
    UNION SELECT workspace_id FROM outreach_follow_up_tasks
    UNION SELECT workspace_id FROM outreach_bookings
    UNION SELECT workspace_id FROM outreach_deliveries
    UNION SELECT workspace_id FROM outreach_leads
  `);
  return res.rows.map((r) => r.workspace_id);
}

export async function saveOutreachStoreToPg(store: OutreachStoreShape): Promise<void> {
  const ids = new Set<string>();
  for (const lead of store.leads) ids.add(lead.workspaceId);
  for (const c of store.campaigns) ids.add(c.workspaceId);
  for (const s of store.sequences) ids.add(s.workspaceId);
  for (const e of store.enrollments) ids.add(e.workspaceId);
  for (const d of store.deliveries) ids.add(d.workspaceId);
  for (const key of Object.keys(store.controls)) ids.add(key);
  for (const id of ids) {
    await saveWorkspaceOutreachToPg(id, store);
  }
}

// silence unused helper warning in some builds
void replaceWorkspaceRows;
