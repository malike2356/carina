import type { OutreachLead, PipelineStatus, LeadSource } from '../types.js';
import { pool } from '../../memory/db.js';
import { rejectMissingWorkspaceId } from '../../hosted/workspace-scoped-query.js';
import { hydrateLeadCompat } from '../lead-ingest.js';

export type LeadListFilter = {
  campaignId?: string;
  status?: PipelineStatus;
  source?: LeadSource;
  tag?: string;
  niche?: string;
  priority?: string;
  townCity?: string;
  q?: string;
  hasEmail?: boolean;
  replied?: boolean;
};

export type LeadPageCursor = {
  updatedAt: string;
  id: string;
};

/**
 * Keyset pagination for CRM leads. Does not load the full workspace lead set.
 */
export async function listLeadsPageFromPg(
  workspaceId: string,
  filter: LeadListFilter | undefined,
  opts: { limit: number; cursor?: LeadPageCursor | null },
): Promise<{ leads: OutreachLead[]; nextCursor: LeadPageCursor | null; total: number }> {
  rejectMissingWorkspaceId(workspaceId);
  const limit = Math.min(200, Math.max(1, opts.limit || 50));
  const params: unknown[] = [workspaceId];
  const where: string[] = ['workspace_id = $1'];

  if (filter?.status) {
    params.push(filter.status, filter.status);
    where.push(`(status = $${params.length - 1} OR pipeline_stage = $${params.length})`);
  }
  if (filter?.source) {
    params.push(filter.source, filter.source);
    where.push(`(source = $${params.length - 1} OR payload->>'sourceType' = $${params.length})`);
  }
  if (filter?.campaignId) {
    params.push(filter.campaignId, filter.campaignId);
    where.push(
      `(payload->>'campaignId' = $${params.length - 1} OR payload->'campaignIds' ? $${params.length})`,
    );
  }
  if (filter?.niche) {
    params.push(`%${filter.niche.toLowerCase()}%`);
    where.push(`lower(coalesce(niche,'')) LIKE $${params.length}`);
  }
  if (filter?.priority) {
    params.push(filter.priority.toLowerCase());
    where.push(`lower(coalesce(priority,'')) = $${params.length}`);
  }
  if (filter?.townCity) {
    params.push(`%${filter.townCity.toLowerCase()}%`);
    where.push(`lower(coalesce(town_city,'')) LIKE $${params.length}`);
  }
  if (filter?.hasEmail === true) where.push('has_email = true');
  if (filter?.hasEmail === false) where.push('has_email = false');
  if (filter?.replied === true) where.push('replied = true');
  if (filter?.tag) {
    params.push(filter.tag);
    where.push(`payload->'tags' ? $${params.length}`);
  }
  if (filter?.q) {
    params.push(`%${filter.q.toLowerCase()}%`);
    where.push(`lower(coalesce(payload->>'name','') || ' ' || coalesce(payload->>'contactName','') || ' ' ||
      coalesce(email,'') || ' ' || coalesce(company,'') || ' ' || coalesce(niche,'') || ' ' ||
      coalesce(town_city,'') || ' ' || coalesce(payload->>'website','') || ' ' || coalesce(payload->>'notes',''))
      LIKE $${params.length}`);
  }

  const whereSql = where.join(' AND ');
  const countRes = await pool.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM outreach_leads WHERE ${whereSql}`,
    params,
  );
  const total = Number(countRes.rows[0]?.c || 0);

  const pageParams = [...params];
  let cursorSql = '';
  if (opts.cursor?.updatedAt && opts.cursor?.id) {
    pageParams.push(opts.cursor.updatedAt, opts.cursor.id);
    cursorSql = ` AND (updated_at, id) < ($${pageParams.length - 1}::timestamptz, $${pageParams.length})`;
  }
  pageParams.push(limit + 1);
  const res = await pool.query<{ payload: OutreachLead; updated_at: string; id: string }>(
    `SELECT payload, updated_at, id FROM outreach_leads
     WHERE ${whereSql}${cursorSql}
     ORDER BY updated_at DESC, id DESC
     LIMIT $${pageParams.length}`,
    pageParams,
  );

  const rows = res.rows;
  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const leads = slice.map((r) => hydrateLeadCompat(r.payload));
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last
      ? { updatedAt: new Date(last.updated_at).toISOString(), id: last.id }
      : null;
  return { leads, nextCursor, total };
}

export async function getLeadFromPg(workspaceId: string, leadId: string): Promise<OutreachLead | null> {
  rejectMissingWorkspaceId(workspaceId);
  const res = await pool.query<{ payload: OutreachLead }>(
    `SELECT payload FROM outreach_leads WHERE workspace_id = $1 AND id = $2`,
    [workspaceId, leadId],
  );
  const row = res.rows[0];
  return row ? hydrateLeadCompat(row.payload) : null;
}

/**
 * Compare-and-swap lead update. Returns null if version mismatch.
 */
export async function updateLeadCas(
  workspaceId: string,
  leadId: string,
  expectedVersion: number,
  next: OutreachLead,
): Promise<OutreachLead | null> {
  rejectMissingWorkspaceId(workspaceId);
  const idxEmail = next.email || null;
  const res = await pool.query<{ payload: OutreachLead }>(
    `UPDATE outreach_leads SET
      email = $4,
      status = $5,
      pipeline_stage = $6,
      source = $7,
      company = $8,
      niche = $9,
      town_city = $10,
      priority = $11,
      has_email = $12,
      replied = $13,
      next_action_at = $14,
      updated_at = $15,
      version = version + 1,
      payload = $16
     WHERE workspace_id = $1 AND id = $2 AND version = $3
     RETURNING payload`,
    [
      workspaceId,
      leadId,
      expectedVersion,
      idxEmail,
      next.status,
      next.pipelineStage || next.status || null,
      next.sourceType || next.source || null,
      next.company || null,
      next.niche || null,
      next.townCity || null,
      next.priority != null ? String(next.priority) : null,
      Boolean(next.email),
      next.replyState === 'replied' || Boolean(next.lastReplyAt),
      next.nextActionAt || null,
      next.updatedAt,
      JSON.stringify(next),
    ],
  );
  return res.rows[0] ? hydrateLeadCompat(res.rows[0].payload) : null;
}
