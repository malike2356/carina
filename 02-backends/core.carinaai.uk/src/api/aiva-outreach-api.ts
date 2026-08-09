import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import { ingestLeads } from '../outreach/lead-ingest.js';
import {
  addLeadsToList,
  createCampaign,
  createLead,
  createLeadList,
  createSequence,
  deleteCampaign,
  deleteLead,
  deleteLeadList,
  deleteSequence,
  ensureOutreachDefaults,
  enrollLead,
  getLead,
  importLeadBatch,
  importYouTubeLeadsIntoOutreach,
  listCampaigns,
  listDeliveries,
  listEnrollments,
  listLeadLists,
  listLeads,
  listSequences,
  markDeliveryStatus,
  PIPELINE_STATUSES,
  pipelineSummary,
  recordLeadBooking,
  recordLeadReply,
  recordLeadUnsubscribe,
  listReplyReviews,
  processInboundReply,
  resolveReplyReview,
  retryFailedDelivery,
  stopEnrollment,
  updateCampaign,
  updateLead,
  listAvailability,
  listBookings,
  createBooking,
  rescheduleBooking,
  cancelBooking,
  markBookingNoShow,
  markBookingAttended,
  markBookingConfirmationSent,
  recordPostCallOutcome,
  getBookingConfig,
  updateBookingConfig,
  listReminders,
  processDueReminders,
  getOutreachAlertTarget,
  updateOutreachAlertTarget,
  buildOutreachBoardSummary,
  getOutreachBoardConfig,
  updateOutreachBoardConfig,
  getOutreachControlState,
  pauseOutreach,
  resumeOutreach,
  outreachControlSummary,
  listFollowUpTasks,
  processDueFollowUps,
  buildWeeklyOwnerDigest,
  getOutreachBookingBackend,
  isVicalOutreachBackend,
  resolveVicalHostUserId,
  updateLeadList,
} from '../outreach/index.js';
import { updateSequence } from '../outreach/sequence-engine.js';
import { createDiscoveryLead } from '../outreach/discovery-funnel.js';
import {
  createWorkspaceLeadSheet,
  deleteLeadSheet,
  exportCrmWorkbookCsv,
  exportLeadsCsvText,
  leadSheetCanonicalHeader,
  linkGoogleLeadSheet,
  listLeadSheetConfigs,
  pushCrmLeadsToWorkspaceSheet,
  readWorkspaceLeadSheetRows,
  syncWorkspaceLeadSheetToCrm,
  updateLeadSheetConfig,
} from '../outreach/lead-sheets.js';
import { buildOutreachCadenceSummary } from '../outreach/cadence.js';
import { isPipelineStatus } from '../outreach/pipeline.js';
import { draftCampaignPreview, summariseCampaignOutcomes } from '../outreach/campaign-ops.js';
import { buildFunnelReport } from '../outreach/funnel-analytics.js';
import { convertLeadToContact, markLeadAsCustomer, suggestNextBestAction } from '../outreach/lifecycle.js';
import { assessLeadEnrolmentEligibility } from '../outreach/eligibility.js';
import { backfillOutreachBookingsToVical } from '../vical/index.js';

export const aivaOutreachRouter: ExpressRouter = Router();
aivaOutreachRouter.use(requireCloudProxy);

type OutreachRequest = Request & { workspaceId?: string };

function routeParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return String(value[0] ?? '');
  return String(value ?? '');
}

function resolveWorkspaceId(req: OutreachRequest): string | null {
  const header = req.headers['x-workspace-id'];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  return fromHeader?.trim() || null;
}

/** Lazy-init PG cache even when process boot skipped outreach (e.g. pack install failed earlier). */
aivaOutreachRouter.use(async (_req, res, next) => {
  try {
    const { ensureOutreachStoreReady } = await import('../outreach/store.js');
    await ensureOutreachStoreReady();
    next();
  } catch (err) {
    res.status(503).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

aivaOutreachRouter.use((req: OutreachRequest, res: Response, next) => {
  const workspaceId = resolveWorkspaceId(req);
  if (!workspaceId) {
    res.status(400).json({ error: 'workspaceId is required (X-Workspace-Id header)' });
    return;
  }
  req.workspaceId = workspaceId;
  next();
});

aivaOutreachRouter.get('/overview', (req: OutreachRequest, res: Response) => {
  const defaults = ensureOutreachDefaults(req.workspaceId!);
  res.json({
    summary: pipelineSummary(req.workspaceId!),
    defaults,
    pendingApprovals: listDeliveries(req.workspaceId!).filter((d) => d.status === 'pending_approval').length,
    activeEnrollments: listEnrollments(req.workspaceId!, { status: 'active' }).length,
    openReplyReviews: listReplyReviews(req.workspaceId!, { status: 'open' }).length,
    upcomingBookings: listBookings(req.workspaceId!, { status: 'confirmed' }).filter(
      (b) => new Date(b.startsAt).getTime() >= Date.now(),
    ).length,
    scheduledReminders: listReminders(req.workspaceId!, { status: 'scheduled' }).length,
    funnel: buildFunnelReport(req.workspaceId!),
  });
});

aivaOutreachRouter.get('/funnel', (req: OutreachRequest, res: Response) => {
  ensureOutreachDefaults(req.workspaceId!);
  res.json(buildFunnelReport(req.workspaceId!));
});

aivaOutreachRouter.post('/campaigns/preview', (req: OutreachRequest, res: Response) => {
  const sequenceId = String(req.body?.sequenceId ?? '').trim();
  if (!sequenceId) {
    res.status(400).json({ error: 'sequenceId required' });
    return;
  }
  const preview = draftCampaignPreview({
    workspaceId: req.workspaceId!,
    campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : undefined,
    sequenceId,
    leadIds: Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : undefined,
    listId: typeof req.body?.listId === 'string' ? req.body.listId : undefined,
  });
  res.json(preview);
});

aivaOutreachRouter.get('/campaigns/outcomes', (req: OutreachRequest, res: Response) => {
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  res.json(summariseCampaignOutcomes(req.workspaceId!, campaignId));
});

aivaOutreachRouter.get('/pipeline', (req: OutreachRequest, res: Response) => {
  ensureOutreachDefaults(req.workspaceId!);
  let leads = listLeads(req.workspaceId!);
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  const owner = typeof req.query.owner === 'string' ? req.query.owner : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const replyState = typeof req.query.replyState === 'string' ? req.query.replyState : undefined;
  const bookingState = typeof req.query.bookingState === 'string' ? req.query.bookingState : undefined;
  const dueFollowUp = req.query.dueFollowUp === '1' || req.query.dueFollowUp === 'true';
  if (campaignId) leads = leads.filter((l) => l.campaignId === campaignId);
  if (owner) leads = leads.filter((l) => (l.owner ?? '').toLowerCase().includes(owner.toLowerCase()));
  if (source) leads = leads.filter((l) => l.source === source);
  if (replyState) leads = leads.filter((l) => l.replyState === replyState);
  if (bookingState) leads = leads.filter((l) => l.bookingState === bookingState);
  if (dueFollowUp) {
    const now = Date.now();
    leads = leads.filter((l) => l.status === 'follow_up' || (l.nextActionAt && new Date(l.nextActionAt).getTime() <= now));
  }
  const columns = Object.fromEntries(
    PIPELINE_STATUSES.map((status) => [status, leads.filter((l) => l.status === status)]),
  );
  res.json({ columns, summary: pipelineSummary(req.workspaceId!), filteredCount: leads.length });
});

aivaOutreachRouter.get('/leads', async (req: OutreachRequest, res: Response) => {
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  const status = typeof req.query.status === 'string' && isPipelineStatus(req.query.status)
    ? req.query.status
    : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const niche = typeof req.query.niche === 'string' ? req.query.niche : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const townCity = typeof req.query.townCity === 'string' ? req.query.townCity : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const hasEmail = req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined;
  const replied = req.query.replied === 'true' ? true : req.query.replied === 'false' ? false : undefined;
  const includeArchived = req.query.includeArchived === 'true';
  const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize ?? 50) || 50));
  const sortField = typeof req.query.sort === 'string' ? req.query.sort : 'updatedAt';
  const sortDir = req.query.sortDir === 'asc' ? 'asc' as const : 'desc' as const;
  let cursor: { updatedAt: string; id: string } | null = null;
  if (typeof req.query.cursor === 'string' && req.query.cursor.trim()) {
    try {
      const parsed = JSON.parse(Buffer.from(req.query.cursor, 'base64url').toString('utf8')) as {
        updatedAt?: string;
        id?: string;
      };
      if (parsed.updatedAt && parsed.id) cursor = { updatedAt: parsed.updatedAt, id: parsed.id };
    } catch {
      cursor = null;
    }
  }
  const filter = {
    campaignId,
    status,
    source: source as never,
    tag,
    niche,
    priority,
    townCity,
    q,
    hasEmail,
    replied,
    includeArchived,
  };

  const { isOutreachPostgresEnabled } = await import('../outreach/pg/config.js');
  if (isOutreachPostgresEnabled()) {
    const { listLeadsPageFromPg } = await import('../outreach/pg/leads-repo.js');
    const result = await listLeadsPageFromPg(req.workspaceId!, filter, {
      limit: pageSize,
      cursor,
      sortField: sortField as never,
      sortDir,
    });
    const nextCursor = result.nextCursor
      ? Buffer.from(JSON.stringify(result.nextCursor), 'utf8').toString('base64url')
      : null;
    res.json({
      leads: result.leads,
      total: result.total,
      pageSize,
      nextCursor,
      sort: sortField,
      sortDir,
    });
    return;
  }

  let all = listLeads(req.workspaceId!, filter).filter((l) => includeArchived || !l.archivedAt);
  all = all.sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    const av = String((a as never)[sortField] ?? a.updatedAt ?? '');
    const bv = String((b as never)[sortField] ?? b.updatedAt ?? '');
    return av.localeCompare(bv) * dir;
  });
  let start = 0;
  if (cursor) {
    const idx = all.findIndex((l) => l.id === cursor!.id);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = all.slice(start, start + pageSize);
  const last = slice[slice.length - 1];
  const nextCursor = start + pageSize < all.length && last
    ? Buffer.from(JSON.stringify({ updatedAt: last.updatedAt, id: last.id }), 'utf8').toString('base64url')
    : null;
  res.json({
    leads: slice,
    total: all.length,
    pageSize,
    nextCursor,
    sort: sortField,
    sortDir,
  });
});

aivaOutreachRouter.get('/leads/export', (req: OutreachRequest, res: Response) => {
  const status = typeof req.query.status === 'string' && isPipelineStatus(req.query.status)
    ? req.query.status
    : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const niche = typeof req.query.niche === 'string' ? req.query.niche : undefined;
  const priority = typeof req.query.priority === 'string' ? req.query.priority : undefined;
  const hasEmail = req.query.hasEmail === 'true' ? true : req.query.hasEmail === 'false' ? false : undefined;
  const idsRaw = typeof req.query.ids === 'string' ? req.query.ids : '';
  const leadIds = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
  const format = typeof req.query.format === 'string' ? req.query.format : 'workbook';
  if (format === 'workbook' || format === 'excel' || format === 'csv') {
    const result = exportCrmWorkbookCsv(req.workspaceId!, {
      status,
      source: source as never,
      campaignId,
      q,
      niche,
      priority,
      hasEmail,
      leadIds,
    });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aiva-crm-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send(result.csv);
    return;
  }
  const result = exportLeadsCsvText(req.workspaceId!, {
    status,
    source: source as never,
    campaignId,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="aiva-crm-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
  );
  res.send(result.csv);
});

aivaOutreachRouter.get('/lead-sheets', (req: OutreachRequest, res: Response) => {
  res.json({
    sheets: listLeadSheetConfigs(req.workspaceId!),
    header: leadSheetCanonicalHeader(),
  });
});

aivaOutreachRouter.post('/lead-sheets', (req: OutreachRequest, res: Response) => {
  const kind = String(req.body?.kind ?? 'workspace_csv');
  if (kind === 'google_sheet') {
    const googleSpreadsheetId = String(req.body?.googleSpreadsheetId ?? '').trim();
    if (!googleSpreadsheetId) {
      res.status(400).json({ error: 'googleSpreadsheetId required for google_sheet' });
      return;
    }
    const sheet = linkGoogleLeadSheet({
      workspaceId: req.workspaceId!,
      googleSpreadsheetId,
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      googleSheetUrl: typeof req.body?.googleSheetUrl === 'string' ? req.body.googleSheetUrl : undefined,
    });
    res.status(201).json({ sheet });
    return;
  }
  const sheet = createWorkspaceLeadSheet({
    workspaceId: req.workspaceId!,
    name: typeof req.body?.name === 'string' ? req.body.name : undefined,
    seedFromLeads: req.body?.seedFromLeads === true,
  });
  res.status(201).json({ sheet });
});

aivaOutreachRouter.get('/lead-sheets/:sheetId/rows', (req: OutreachRequest, res: Response) => {
  const sheetId = routeParam(req.params.sheetId);
  const offset = req.query.offset != null ? Number(req.query.offset) : undefined;
  const limit = req.query.limit != null ? Number(req.query.limit) : undefined;
  const result = readWorkspaceLeadSheetRows(req.workspaceId!, sheetId, { offset, limit });
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json(result);
});

aivaOutreachRouter.post('/lead-sheets/:sheetId/sync', (req: OutreachRequest, res: Response) => {
  const sheetId = routeParam(req.params.sheetId);
  const result = syncWorkspaceLeadSheetToCrm(req.workspaceId!, sheetId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

aivaOutreachRouter.post('/lead-sheets/:sheetId/push', (req: OutreachRequest, res: Response) => {
  const sheetId = routeParam(req.params.sheetId);
  const result = pushCrmLeadsToWorkspaceSheet(req.workspaceId!, sheetId);
  if (!result.ok) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

aivaOutreachRouter.patch('/lead-sheets/:sheetId', (req: OutreachRequest, res: Response) => {
  const sheetId = routeParam(req.params.sheetId);
  const sheet = updateLeadSheetConfig(req.workspaceId!, sheetId, {
    name: typeof req.body?.name === 'string' ? req.body.name : undefined,
    googleSpreadsheetId: typeof req.body?.googleSpreadsheetId === 'string' ? req.body.googleSpreadsheetId : undefined,
    googleSheetUrl: req.body?.googleSheetUrl === null
      ? null
      : (typeof req.body?.googleSheetUrl === 'string' ? req.body.googleSheetUrl : undefined),
  });
  if (!sheet) {
    res.status(404).json({ error: 'Lead sheet not found' });
    return;
  }
  res.json({ sheet });
});

aivaOutreachRouter.delete('/lead-sheets/:sheetId', (req: OutreachRequest, res: Response) => {
  const sheetId = routeParam(req.params.sheetId);
  const result = deleteLeadSheet(req.workspaceId!, sheetId);
  if (!result.ok) {
    res.status(404).json({ error: result.error });
    return;
  }
  res.json(result);
});

aivaOutreachRouter.post('/leads', (req: OutreachRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const result = createLead({
    workspaceId: req.workspaceId!,
    name,
    email: req.body?.email,
    phone: req.body?.phone,
    company: req.body?.company,
    source: req.body?.source,
    campaignId: req.body?.campaignId,
    owner: req.body?.owner,
    notes: req.body?.notes,
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
    timezone: req.body?.timezone,
  });
  res.status(result.duplicateOf ? 200 : 201).json(result);
});

aivaOutreachRouter.post('/leads/import', (req: OutreachRequest, res: Response) => {
  const rows = Array.isArray(req.body?.leads)
    ? req.body.leads
    : (Array.isArray(req.body?.rows) ? req.body.rows : []);
  if (rows.length === 0) {
    res.status(400).json({ error: 'leads array is required' });
    return;
  }
  const overwrite = Boolean(req.body?.overwrite);
  try {
    const ingest = ingestLeads({
      workspaceId: req.workspaceId!,
      rows: rows as Record<string, unknown>[],
      sourceType: typeof req.body?.sourceType === 'string' ? req.body.sourceType : 'csv_import',
      sourceName: typeof req.body?.sourceName === 'string' ? req.body.sourceName : undefined,
      sourceUrl: typeof req.body?.sourceUrl === 'string' ? req.body.sourceUrl : undefined,
      campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : undefined,
      overwrite,
      kind: 'import',
    });
    const createdIds = new Set(
      ingest.rowResults.filter((r) => r.outcome === 'created' && r.leadId).map((r) => r.leadId!),
    );
    const dupIds = new Set(
      ingest.rowResults
        .filter((r) => (r.outcome === 'duplicate' || r.outcome === 'updated') && r.leadId)
        .map((r) => r.leadId!),
    );
    res.status(201).json({
      created: ingest.leads.filter((l) => createdIds.has(l.id)),
      duplicates: ingest.leads.filter((l) => dupIds.has(l.id) && !createdIds.has(l.id)),
      counts: {
        created: ingest.created,
        updated: ingest.updated,
        duplicate: ingest.duplicate,
        rejected: ingest.rejected,
        warning: ingest.warning,
      },
      jobId: ingest.jobId,
      rowResults: ingest.rowResults.slice(0, 200),
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/leads/import-youtube', (req: OutreachRequest, res: Response) => {
  const channelId = String(req.body?.channelId ?? '').trim();
  if (!channelId) {
    res.status(400).json({ error: 'channelId is required' });
    return;
  }
  const defaults = ensureOutreachDefaults(req.workspaceId!);
  const result = importYouTubeLeadsIntoOutreach({
    workspaceId: req.workspaceId!,
    channelId,
    campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : defaults.campaign.id,
  });
  res.json(result);
});

aivaOutreachRouter.post('/leads/bulk', async (req: OutreachRequest, res: Response) => {
  try {
    const { applyBulkLeadAction } = await import('../outreach/bulk-leads.js');
    const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : [];
    const action = String(req.body?.action ?? '').trim() as never;
    if (!leadIds.length || !action) {
      res.status(400).json({ error: 'leadIds and action are required' });
      return;
    }
    const result = await applyBulkLeadAction({
      workspaceId: req.workspaceId!,
      leadIds,
      action,
      status: typeof req.body?.status === 'string' ? req.body.status : undefined,
      priority: typeof req.body?.priority === 'string' ? req.body.priority : undefined,
      owner: typeof req.body?.owner === 'string' ? req.body.owner : undefined,
      ownerWorkerId: typeof req.body?.ownerWorkerId === 'string' ? req.body.ownerWorkerId : undefined,
      tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
      listId: typeof req.body?.listId === 'string' ? req.body.listId : undefined,
      sequenceId: typeof req.body?.sequenceId === 'string' ? req.body.sequenceId : undefined,
      campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : undefined,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/leads/:leadId', (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({
    lead,
    deliveries: listDeliveries(req.workspaceId!, { leadId: lead.id }),
    enrollments: listEnrollments(req.workspaceId!, { leadId: lead.id }),
  });
});

aivaOutreachRouter.patch('/leads/:leadId', async (req: OutreachRequest, res: Response) => {
  const leadId = routeParam(req.params.leadId);
  const patch = {
    name: req.body?.name,
    email: req.body?.email,
    phone: req.body?.phone,
    company: req.body?.company,
    campaignId: req.body?.campaignId,
    owner: req.body?.owner,
    notes: req.body?.notes,
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
    timezone: req.body?.timezone,
    status: req.body?.status,
    replyState: req.body?.replyState,
    bookingState: req.body?.bookingState,
    nextActionAt: req.body?.nextActionAt,
    niche: req.body?.niche,
    townCity: req.body?.townCity,
    website: req.body?.website,
    contactName: req.body?.contactName,
    googleReviews: req.body?.googleReviews,
    googleRating: req.body?.googleRating,
    googleMapsUrl: req.body?.googleMapsUrl,
    websiteScore: req.body?.websiteScore,
    ranksTop3: req.body?.ranksTop3,
    weakness: req.body?.weakness,
    priority: req.body?.priority,
    sourceUrl: req.body?.sourceUrl,
    sourceName: req.body?.sourceName,
    pipelineStage: req.body?.pipelineStage,
    ownerWorkerId: req.body?.ownerWorkerId,
    listIds: Array.isArray(req.body?.listIds) ? req.body.listIds.map(String) : undefined,
    campaignIds: Array.isArray(req.body?.campaignIds) ? req.body.campaignIds.map(String) : undefined,
    sequenceId: req.body?.sequenceId,
    archivedAt: req.body?.archivedAt,
    customFields: req.body?.customFields && typeof req.body.customFields === 'object'
      ? req.body.customFields as Record<string, unknown>
      : undefined,
  };
  const lead = updateLead(req.workspaceId!, leadId, patch);
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }

  const expectedVersion = Number(req.body?.version);
  if (Number.isFinite(expectedVersion)) {
    const { isOutreachPostgresEnabled } = await import('../outreach/pg/config.js');
    if (isOutreachPostgresEnabled()) {
      const { updateLeadCas } = await import('../outreach/pg/leads-repo.js');
      const cas = await updateLeadCas(req.workspaceId!, leadId, expectedVersion, lead);
      if (!cas) {
        res.status(409).json({ error: 'conflict', message: 'Lead was modified by another session' });
        return;
      }
      res.json({ lead: cas });
      return;
    }
  }

  res.json({ lead });
});

aivaOutreachRouter.get('/lead-views', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ listLeadViews, GRID_PREFS_VIEW_NAME }) => {
    const userId = String(req.headers['x-user-id'] ?? 'workspace_owner');
    const views = listLeadViews(req.workspaceId!, userId)
      .filter((v) => v.name !== GRID_PREFS_VIEW_NAME);
    res.json({ views });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.post('/lead-views', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ createLeadView }) => {
    const userId = String(req.headers['x-user-id'] ?? req.body?.ownerUserId ?? 'workspace_owner');
    const view = createLeadView({
      workspaceId: req.workspaceId!,
      name: String(req.body?.name ?? 'Saved view'),
      ownerUserId: userId,
      filters: req.body?.filters && typeof req.body.filters === 'object' ? req.body.filters : {},
      columns: Array.isArray(req.body?.columns) ? req.body.columns.map(String) : undefined,
      columnOrder: Array.isArray(req.body?.columnOrder) ? req.body.columnOrder.map(String) : undefined,
      columnWidths: req.body?.columnWidths && typeof req.body.columnWidths === 'object' ? req.body.columnWidths : undefined,
      hiddenColumns: Array.isArray(req.body?.hiddenColumns) ? req.body.hiddenColumns.map(String) : undefined,
      sort: req.body?.sort,
      density: req.body?.density,
      shared: Boolean(req.body?.shared),
      sharedWith: Array.isArray(req.body?.sharedWith) ? req.body.sharedWith.map(String) : undefined,
    });
    res.status(201).json({ view });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.patch('/lead-views/:viewId', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ updateLeadView }) => {
    const userId = String(req.headers['x-user-id'] ?? 'workspace_owner');
    const view = updateLeadView(req.workspaceId!, routeParam(req.params.viewId), {
      name: typeof req.body?.name === 'string' ? req.body.name : undefined,
      filters: req.body?.filters,
      columns: req.body?.columns,
      columnOrder: req.body?.columnOrder,
      columnWidths: req.body?.columnWidths,
      hiddenColumns: req.body?.hiddenColumns,
      sort: req.body?.sort,
      density: req.body?.density,
      shared: typeof req.body?.shared === 'boolean' ? req.body.shared : undefined,
      sharedWith: Array.isArray(req.body?.sharedWith) ? req.body.sharedWith.map(String) : undefined,
    }, userId);
    if (!view) {
      res.status(404).json({ error: 'View not found or not owned' });
      return;
    }
    res.json({ view });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.delete('/lead-views/:viewId', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ deleteLeadView }) => {
    const userId = String(req.headers['x-user-id'] ?? 'workspace_owner');
    const ok = deleteLeadView(req.workspaceId!, routeParam(req.params.viewId), userId);
    if (!ok) {
      res.status(404).json({ error: 'View not found or not owned' });
      return;
    }
    res.json({ ok: true });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.get('/grid-prefs', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ getGridPrefs }) => {
    const userId = String(req.headers['x-user-id'] ?? 'workspace_owner');
    res.json({ prefs: getGridPrefs(req.workspaceId!, userId) });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.put('/grid-prefs', (req: OutreachRequest, res: Response) => {
  void import('../outreach/lead-views.js').then(({ upsertGridPrefs }) => {
    const userId = String(req.headers['x-user-id'] ?? 'workspace_owner');
    const prefs = upsertGridPrefs({
      workspaceId: req.workspaceId!,
      ownerUserId: userId,
      columnOrder: Array.isArray(req.body?.columnOrder) ? req.body.columnOrder.map(String) : undefined,
      columnWidths: req.body?.columnWidths && typeof req.body.columnWidths === 'object' ? req.body.columnWidths : undefined,
      hiddenColumns: Array.isArray(req.body?.hiddenColumns) ? req.body.hiddenColumns.map(String) : undefined,
      density: req.body?.density,
      sort: req.body?.sort,
    });
    res.json({ prefs });
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.get('/leads/:leadId/activity', async (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  const deliveries = listDeliveries(req.workspaceId!, { leadId: lead.id });
  const enrollments = listEnrollments(req.workspaceId!, { leadId: lead.id });
  let providerEvents: Array<Record<string, unknown>> = [];
  try {
    const { listProviderEvents } = await import('../outreach/provider-events/persist.js');
    for (const d of deliveries.slice(0, 20)) {
      const events = await listProviderEvents({ workspaceId: req.workspaceId!, deliveryId: d.id, limit: 20 });
      providerEvents = providerEvents.concat(events);
    }
  } catch {
    providerEvents = [];
  }
  const bookings = listBookings(req.workspaceId!, { leadId: lead.id });
  const tasks = listFollowUpTasks(req.workspaceId!).filter((t) => t.leadId === lead.id);
  res.json({
    leadId: lead.id,
    timeline: lead.timeline || [],
    deliveries,
    providerEvents,
    enrollments,
    bookings,
    tasks,
    provenance: {
      sourceType: lead.sourceType || lead.source,
      sourceName: lead.sourceName,
      sourceUrl: lead.sourceUrl,
      sourceCapturedAt: lead.sourceCapturedAt,
      sourceJobId: lead.sourceJobId,
      confidence: lead.customFields?.confidence,
      enrichment: lead.customFields?.enrichmentChanges,
    },
  });
});

aivaOutreachRouter.delete('/leads/:leadId', (req: OutreachRequest, res: Response) => {
  const ok = deleteLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!ok) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ ok: true });
});

aivaOutreachRouter.post('/leads/:leadId/reply', (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  recordLeadReply(req.workspaceId!, lead.id);
  res.json({ lead: getLead(req.workspaceId!, lead.id) });
});

aivaOutreachRouter.post('/leads/:leadId/booked', (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  recordLeadBooking(req.workspaceId!, lead.id);
  res.json({ lead: getLead(req.workspaceId!, lead.id) });
});

aivaOutreachRouter.post('/leads/:leadId/unsubscribe', (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  recordLeadUnsubscribe(req.workspaceId!, lead.id);
  res.json({ lead: getLead(req.workspaceId!, lead.id) });
});

aivaOutreachRouter.post('/leads/:leadId/convert-contact', (req: OutreachRequest, res: Response) => {
  const lead = convertLeadToContact(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ lead, nextBestAction: suggestNextBestAction(lead) });
});

aivaOutreachRouter.post('/leads/:leadId/convert-customer', (req: OutreachRequest, res: Response) => {
  const lead = markLeadAsCustomer(req.workspaceId!, routeParam(req.params.leadId), {
    value: typeof req.body?.value === 'number' ? req.body.value : undefined,
    note: typeof req.body?.note === 'string' ? req.body.note : undefined,
  });
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ lead, nextBestAction: suggestNextBestAction(lead) });
});

aivaOutreachRouter.get('/leads/:leadId/next-action', (req: OutreachRequest, res: Response) => {
  const lead = getLead(req.workspaceId!, routeParam(req.params.leadId));
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({
    lead,
    nextBestAction: suggestNextBestAction(lead),
    eligibility: assessLeadEnrolmentEligibility(req.workspaceId!, lead),
  });
});

aivaOutreachRouter.get('/replies/review', (req: OutreachRequest, res: Response) => {
  const status = typeof req.query.status === 'string' && (req.query.status === 'open' || req.query.status === 'resolved')
    ? req.query.status
    : undefined;
  res.json({ reviews: listReplyReviews(req.workspaceId!, status ? { status } : undefined) });
});

aivaOutreachRouter.post('/replies/inbound', async (req: OutreachRequest, res: Response) => {
  const fromEmail = String(req.body?.fromEmail ?? req.body?.from ?? '').trim();
  const subject = String(req.body?.subject ?? '').trim();
  const body = String(req.body?.body ?? req.body?.text ?? '').trim();
  if (!fromEmail || !subject || !body) {
    res.status(400).json({ error: 'fromEmail, subject, and body are required' });
    return;
  }
  try {
    const { ingestRawInbound } = await import('../outreach/inbound/ingest.js');
    const ingested = await ingestRawInbound({
      workspaceId: req.workspaceId!,
      workerId: typeof req.body?.workerId === 'string' ? req.body.workerId : undefined,
      provider: typeof req.body?.provider === 'string' ? req.body.provider as 'manual' : 'manual',
      providerMessageId: typeof req.body?.sourceMessageId === 'string' && req.body.sourceMessageId.trim()
        ? req.body.sourceMessageId.trim()
        : `manual-${Date.now()}-${fromEmail}`,
      threadId: typeof req.body?.threadId === 'string' ? req.body.threadId : undefined,
      inReplyTo: typeof req.body?.inReplyTo === 'string' ? req.body.inReplyTo : undefined,
      references: typeof req.body?.references === 'string' ? req.body.references : undefined,
      from: fromEmail,
      subject,
      textBody: body,
      receivedAt: typeof req.body?.receivedAt === 'string' ? req.body.receivedAt : undefined,
    });
    const reviews = listReplyReviews(req.workspaceId!);
    const review = reviews.find((r) => r.id === ingested.reviewId) ?? null;
    const lead = ingested.leadId ? getLead(req.workspaceId!, ingested.leadId) : null;
    res.status(201).json({
      ok: true,
      review,
      lead,
      classification: ingested.classification,
      actionTaken: ingested.actionTaken,
      matchMethod: ingested.matchMethod,
      requiresReview: ingested.requiresReview,
      duplicate: ingested.duplicate,
      ingest: ingested,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/replies/:reviewId/resolve', (req: OutreachRequest, res: Response) => {
  const classification = typeof req.body?.classification === 'string' ? req.body.classification : '';
  if (!['interested', 'question', 'not_now', 'unsubscribe', 'ooo', 'unknown'].includes(classification)) {
    res.status(400).json({ error: 'classification is required' });
    return;
  }
  const review = resolveReplyReview({
    workspaceId: req.workspaceId!,
    reviewId: routeParam(req.params.reviewId),
    classification: classification as never,
    note: typeof req.body?.note === 'string' ? req.body.note : undefined,
  });
  if (!review) {
    res.status(404).json({ error: 'Reply review not found' });
    return;
  }
  res.json({ review });
});

aivaOutreachRouter.get('/campaigns', (req: OutreachRequest, res: Response) => {
  ensureOutreachDefaults(req.workspaceId!);
  res.json({ campaigns: listCampaigns(req.workspaceId!) });
});

aivaOutreachRouter.post('/campaigns', (req: OutreachRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const campaign = createCampaign({
    workspaceId: req.workspaceId!,
    name,
    objective: req.body?.objective,
    sourceType: req.body?.sourceType,
    targetAudience: req.body?.targetAudience,
    dailyCap: typeof req.body?.dailyCap === 'number' ? req.body.dailyCap : undefined,
    timezone: req.body?.timezone,
    businessHoursStart: req.body?.businessHoursStart,
    businessHoursEnd: req.body?.businessHoursEnd,
    businessDays: Array.isArray(req.body?.businessDays) ? req.body.businessDays.map(Number) : undefined,
    weeklyTarget: typeof req.body?.weeklyTarget === 'number' ? req.body.weeklyTarget : undefined,
    fromEmail: typeof req.body?.fromEmail === 'string' ? req.body.fromEmail : undefined,
    requireApproval: typeof req.body?.requireApproval === 'boolean' ? req.body.requireApproval : undefined,
    warmupDays: typeof req.body?.warmupDays === 'number' ? req.body.warmupDays : undefined,
    defaultBookingLink: req.body?.defaultBookingLink,
    defaultSequenceId: req.body?.defaultSequenceId,
  });
  res.status(201).json({ campaign });
});

aivaOutreachRouter.patch('/campaigns/:campaignId', (req: OutreachRequest, res: Response) => {
  const campaign = updateCampaign(req.workspaceId!, routeParam(req.params.campaignId), {
    name: req.body?.name,
    objective: req.body?.objective,
    targetAudience: req.body?.targetAudience,
    active: typeof req.body?.active === 'boolean' ? req.body.active : undefined,
    dailyCap: typeof req.body?.dailyCap === 'number' ? req.body.dailyCap : undefined,
    timezone: req.body?.timezone,
    businessHoursStart: req.body?.businessHoursStart,
    businessHoursEnd: req.body?.businessHoursEnd,
    businessDays: Array.isArray(req.body?.businessDays) ? req.body.businessDays.map(Number) : undefined,
    weeklyTarget: typeof req.body?.weeklyTarget === 'number' ? req.body.weeklyTarget : req.body?.weeklyTarget === null ? null : undefined,
    fromEmail: typeof req.body?.fromEmail === 'string' ? req.body.fromEmail : req.body?.fromEmail === null ? null : undefined,
    requireApproval: typeof req.body?.requireApproval === 'boolean' ? req.body.requireApproval : undefined,
    warmupDays: typeof req.body?.warmupDays === 'number' ? req.body.warmupDays : req.body?.warmupDays === null ? null : undefined,
    defaultBookingLink: req.body?.defaultBookingLink,
    defaultSequenceId: req.body?.defaultSequenceId,
  });
  if (!campaign) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  res.json({ campaign });
});

aivaOutreachRouter.delete('/campaigns/:campaignId', (req: OutreachRequest, res: Response) => {
  const campaignId = routeParam(req.params.campaignId);
  if (!deleteCampaign(req.workspaceId!, campaignId)) {
    res.status(404).json({ error: 'Campaign not found' });
    return;
  }
  res.json({ deleted: campaignId });
});

aivaOutreachRouter.get('/lists', (req: OutreachRequest, res: Response) => {
  res.json({ lists: listLeadLists(req.workspaceId!) });
});

aivaOutreachRouter.post('/lists', (req: OutreachRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const list = createLeadList({
    workspaceId: req.workspaceId!,
    name,
    description: req.body?.description,
    leadIds: Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : undefined,
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
  });
  res.status(201).json({ list });
});

aivaOutreachRouter.patch('/lists/:listId', (req: OutreachRequest, res: Response) => {
  const list = updateLeadList(req.workspaceId!, routeParam(req.params.listId), {
    name: req.body?.name,
    description: req.body?.description,
    leadIds: Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : undefined,
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : undefined,
  });
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.json({ list });
});

aivaOutreachRouter.delete('/lists/:listId', (req: OutreachRequest, res: Response) => {
  const listId = routeParam(req.params.listId);
  if (!deleteLeadList(req.workspaceId!, listId)) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.json({ deleted: listId });
});

aivaOutreachRouter.post('/lists/:listId/leads', (req: OutreachRequest, res: Response) => {
  const leadIds = Array.isArray(req.body?.leadIds) ? req.body.leadIds.map(String) : [];
  const list = addLeadsToList(req.workspaceId!, routeParam(req.params.listId), leadIds);
  if (!list) {
    res.status(404).json({ error: 'List not found' });
    return;
  }
  res.json({ list });
});

aivaOutreachRouter.get('/sequences', (req: OutreachRequest, res: Response) => {
  ensureOutreachDefaults(req.workspaceId!);
  res.json({ sequences: listSequences(req.workspaceId!) });
});

aivaOutreachRouter.post('/sequences', (req: OutreachRequest, res: Response) => {
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name is required' });
    return;
  }
  const sequence = createSequence({
    workspaceId: req.workspaceId!,
    name,
    description: req.body?.description,
    channelDefault: req.body?.channelDefault,
    steps: Array.isArray(req.body?.steps) ? req.body.steps : undefined,
    stopOnReply: req.body?.stopOnReply,
    stopOnBooking: req.body?.stopOnBooking,
    stopOnUnsubscribe: req.body?.stopOnUnsubscribe,
  });
  res.status(201).json({ sequence });
});

aivaOutreachRouter.patch('/sequences/:sequenceId', (req: OutreachRequest, res: Response) => {
  const sequence = updateSequence(req.workspaceId!, routeParam(req.params.sequenceId), {
    name: req.body?.name,
    description: req.body?.description,
    channelDefault: req.body?.channelDefault,
    steps: Array.isArray(req.body?.steps) ? req.body.steps : undefined,
    stopOnReply: typeof req.body?.stopOnReply === 'boolean' ? req.body.stopOnReply : undefined,
    stopOnBooking: typeof req.body?.stopOnBooking === 'boolean' ? req.body.stopOnBooking : undefined,
    stopOnUnsubscribe: typeof req.body?.stopOnUnsubscribe === 'boolean' ? req.body.stopOnUnsubscribe : undefined,
  });
  if (!sequence) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json({ sequence });
});

aivaOutreachRouter.delete('/sequences/:sequenceId', (req: OutreachRequest, res: Response) => {
  const sequenceId = routeParam(req.params.sequenceId);
  if (!deleteSequence(req.workspaceId!, sequenceId)) {
    res.status(404).json({ error: 'Sequence not found' });
    return;
  }
  res.json({ deleted: sequenceId });
});

aivaOutreachRouter.get('/enrollments', (req: OutreachRequest, res: Response) => {
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({
    enrollments: listEnrollments(req.workspaceId!, {
      leadId,
      campaignId,
      status: status as never,
    }),
  });
});

aivaOutreachRouter.post('/enrollments', (req: OutreachRequest, res: Response) => {
  try {
    const enrollment = enrollLead({
      workspaceId: req.workspaceId!,
      leadId: String(req.body?.leadId ?? '').trim(),
      sequenceId: String(req.body?.sequenceId ?? '').trim(),
      campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : undefined,
    });
    res.status(201).json({ enrollment });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/enrollments/:enrollmentId/pause', (req: OutreachRequest, res: Response) => {
  const enrollment = stopEnrollment(req.workspaceId!, routeParam(req.params.enrollmentId), 'manual_pause');
  if (!enrollment) {
    res.status(404).json({ error: 'Enrollment not found' });
    return;
  }
  res.json({ enrollment });
});

aivaOutreachRouter.post('/companies-house/import-lead', (req: OutreachRequest, res: Response) => {
  const companyNumber = String(req.body?.companyNumber ?? '').trim().toUpperCase();
  const companyName = String(req.body?.companyName ?? '').trim();
  if (!companyNumber || !companyName) {
    res.status(400).json({ error: 'companyNumber and companyName are required' });
    return;
  }
  const officerNames = Array.isArray(req.body?.officerNames)
    ? req.body.officerNames
        .filter((value: unknown) => typeof value === 'string')
        .map((value: string) => value.trim())
        .filter(Boolean)
    : [];
  const notesParts = [
    typeof req.body?.companyStatus === 'string' ? `Status: ${req.body.companyStatus}` : '',
    typeof req.body?.registeredOffice === 'string' ? `Office: ${req.body.registeredOffice}` : '',
    Array.isArray(req.body?.sicCodes) && req.body.sicCodes.length > 0
      ? `SIC: ${req.body.sicCodes.map(String).join(', ')}`
      : '',
    officerNames.length > 0 ? `Officers: ${officerNames.join(', ')}` : '',
  ].filter(Boolean);
  const result = createDiscoveryLead(req.workspaceId!, {
    name: companyName,
    company: companyName,
    companyNumber,
    email: typeof req.body?.email === 'string' ? req.body.email : undefined,
    phone: typeof req.body?.phone === 'string' ? req.body.phone : undefined,
    source: 'companies_house',
    campaignId: typeof req.body?.campaignId === 'string' ? req.body.campaignId : undefined,
    tags: Array.isArray(req.body?.tags) ? req.body.tags.map(String) : ['companies_house'],
    notes: [
      typeof req.body?.notes === 'string' ? req.body.notes.trim() : '',
      notesParts.join(' | '),
    ].filter(Boolean).join('\n'),
  });
  res.status(result.duplicateOf ? 200 : 201).json({
    ...result,
    imported: !result.duplicateOf,
  });
});

aivaOutreachRouter.post('/process-due', async (req: OutreachRequest, res: Response) => {
  const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId : undefined;
  const { processDueSendsWithSoftWall } = await import('../outreach/soft-wall-approvals.js');
  const result = await processDueSendsWithSoftWall(req.workspaceId!, new Date(), workerId);
  res.json({
    ...result,
    note: 'Soft Wall: deliveries are queued in Approvals; cold email is not sent until an owner approves.',
  });
});

aivaOutreachRouter.get('/cadence', async (req: OutreachRequest, res: Response) => {
  const workerId = typeof req.query.workerId === 'string' ? req.query.workerId : undefined;
  const summary = await buildOutreachCadenceSummary({
    workspaceId: req.workspaceId!,
    workerId,
  });
  res.json({ summary });
});

aivaOutreachRouter.get('/deliveries', (req: OutreachRequest, res: Response) => {
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  const enrollmentId = typeof req.query.enrollmentId === 'string' ? req.query.enrollmentId : undefined;
  res.json({ deliveries: listDeliveries(req.workspaceId!, { leadId, enrollmentId }) });
});

aivaOutreachRouter.patch('/deliveries/:deliveryId', (req: OutreachRequest, res: Response) => {
  const status = String(req.body?.status ?? '').trim();
  const allowed = [
    'scheduled',
    'pending_approval',
    'sent',
    'delivered',
    'bounced',
    'failed',
    'replied',
    'unsubscribed',
    'skipped',
  ];
  if (!allowed.includes(status)) {
    res.status(400).json({ error: 'Invalid delivery status' });
    return;
  }
  const delivery = markDeliveryStatus(req.workspaceId!, routeParam(req.params.deliveryId), status as never, {
    lastError: typeof req.body?.lastError === 'string' ? req.body.lastError : undefined,
    approvalId: typeof req.body?.approvalId === 'string' ? req.body.approvalId : undefined,
  });
  if (!delivery) {
    res.status(404).json({ error: 'Delivery not found' });
    return;
  }
  res.json({ delivery });
});

aivaOutreachRouter.post('/deliveries/:deliveryId/retry', (req: OutreachRequest, res: Response) => {
  const delivery = retryFailedDelivery(req.workspaceId!, routeParam(req.params.deliveryId));
  if (!delivery) {
    res.status(404).json({ error: 'Failed delivery not found' });
    return;
  }
  res.json({ delivery });
});

aivaOutreachRouter.get('/availability', (req: OutreachRequest, res: Response) => {
  const config = getBookingConfig(req.workspaceId!);
  const fromRaw = typeof req.query.from === 'string' ? req.query.from : new Date().toISOString();
  const days = typeof req.query.days === 'string' ? Number(req.query.days) : 7;
  const slotMinutes = typeof req.query.slotMinutes === 'string' ? Number(req.query.slotMinutes) : config.slotMinutes;
  const slots = listAvailability({
    workspaceId: req.workspaceId!,
    from: new Date(fromRaw),
    days: Number.isFinite(days) ? days : 7,
    slotMinutes: Number.isFinite(slotMinutes) ? slotMinutes : 30,
    timezone: typeof req.query.timezone === 'string' ? req.query.timezone : config.timezone,
    businessHoursStart: config.windows[0]?.start,
    businessHoursEnd: config.windows[0]?.end,
    businessDays: config.windows.map((window) => window.dayOfWeek),
  });
  res.json({ slots });
});

aivaOutreachRouter.get('/booking-config', (req: OutreachRequest, res: Response) => {
  res.json({ config: getBookingConfig(req.workspaceId!) });
});

aivaOutreachRouter.get('/booking-engine', (req: OutreachRequest, res: Response) => {
  res.json({
    backend: getOutreachBookingBackend(),
    vical: isVicalOutreachBackend(),
    note: isVicalOutreachBackend()
      ? 'Merged engine: viCal owns slots/locks; outreach mirrors Kanban/reminders/Soft Wall.'
      : 'Legacy JSON-only booking path (break-glass).',
  });
});

aivaOutreachRouter.post('/booking-engine/backfill', (req: OutreachRequest, res: Response) => {
  const workspaceId = req.workspaceId!;
  const result = backfillOutreachBookingsToVical({
    workspaceId,
    hostUserId: resolveVicalHostUserId(
      typeof req.body?.hostUserId === 'string' ? req.body.hostUserId : undefined,
    ),
    outreachBookings: listBookings(workspaceId),
    config: getBookingConfig(workspaceId),
  });
  res.json(result);
});

aivaOutreachRouter.patch('/booking-config', (req: OutreachRequest, res: Response) => {
  const config = updateBookingConfig(req.workspaceId!, {
    timezone: typeof req.body?.timezone === 'string' ? req.body.timezone : undefined,
    slotMinutes: typeof req.body?.slotMinutes === 'number' ? req.body.slotMinutes : undefined,
    bufferMinutes: typeof req.body?.bufferMinutes === 'number' ? req.body.bufferMinutes : undefined,
    horizonDays: typeof req.body?.horizonDays === 'number' ? req.body.horizonDays : undefined,
    reminderOffsetsMinutes: Array.isArray(req.body?.reminderOffsetsMinutes) ? req.body.reminderOffsetsMinutes : undefined,
    windows: Array.isArray(req.body?.windows) ? req.body.windows : undefined,
    blockedDates: Array.isArray(req.body?.blockedDates) ? req.body.blockedDates : undefined,
    meetingMode: req.body?.meetingMode === 'zoom' || req.body?.meetingMode === 'google_meet' ? req.body.meetingMode : undefined,
    zoomRoomUrl: typeof req.body?.zoomRoomUrl === 'string' ? req.body.zoomRoomUrl : undefined,
    prepVideoUrl: typeof req.body?.prepVideoUrl === 'string' ? req.body.prepVideoUrl : undefined,
    prepVideoTitle: typeof req.body?.prepVideoTitle === 'string' ? req.body.prepVideoTitle : undefined,
    prepVideoPassword: typeof req.body?.prepVideoPassword === 'string' ? req.body.prepVideoPassword : undefined,
  });
  res.json({ config });
});

aivaOutreachRouter.get('/board-config', (req: OutreachRequest, res: Response) => {
  res.json({
    config: getOutreachBoardConfig(req.workspaceId!),
    summary: buildOutreachBoardSummary(req.workspaceId!),
  });
});

aivaOutreachRouter.patch('/board-config', (req: OutreachRequest, res: Response) => {
  const config = updateOutreachBoardConfig(req.workspaceId!, {
    backend: req.body?.backend === 'native' || req.body?.backend === 'trello' ? req.body.backend : undefined,
    trelloBoardId: typeof req.body?.trelloBoardId === 'string' ? req.body.trelloBoardId : undefined,
    trelloListIds: req.body?.trelloListIds && typeof req.body.trelloListIds === 'object' ? req.body.trelloListIds : undefined,
    nativeSessionId: typeof req.body?.nativeSessionId === 'string' ? req.body.nativeSessionId : undefined,
    nativeBoardId: typeof req.body?.nativeBoardId === 'string' ? req.body.nativeBoardId : undefined,
    enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
    lastGrantWarning: typeof req.body?.lastGrantWarning === 'string' ? req.body.lastGrantWarning : undefined,
  });
  res.json({
    config,
    summary: buildOutreachBoardSummary(req.workspaceId!),
  });
});

aivaOutreachRouter.get('/alert-target', (req: OutreachRequest, res: Response) => {
  res.json({ target: getOutreachAlertTarget(req.workspaceId!) });
});

aivaOutreachRouter.patch('/alert-target', (req: OutreachRequest, res: Response) => {
  const target = updateOutreachAlertTarget(req.workspaceId!, {
    enabled: typeof req.body?.enabled === 'boolean' ? req.body.enabled : undefined,
    channel: req.body?.channel === 'telegram' ? 'telegram' : undefined,
    conversationId: typeof req.body?.conversationId === 'string' ? req.body.conversationId : undefined,
    workerId: typeof req.body?.workerId === 'string' ? req.body.workerId : undefined,
    label: typeof req.body?.label === 'string' ? req.body.label : undefined,
  });
  res.json({ target });
});

aivaOutreachRouter.get('/control', (req: OutreachRequest, res: Response) => {
  const state = getOutreachControlState(req.workspaceId!);
  res.json({ state, summary: outreachControlSummary(state) });
});

aivaOutreachRouter.patch('/control', (req: OutreachRequest, res: Response) => {
  const action = String(req.body?.action ?? '').trim().toLowerCase();
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  let state;
  if (action === 'pause') {
    state = pauseOutreach(req.workspaceId!, reason, typeof req.body?.updatedBy === 'string' ? req.body.updatedBy : undefined);
  } else if (action === 'resume') {
    state = resumeOutreach(req.workspaceId!, typeof req.body?.updatedBy === 'string' ? req.body.updatedBy : undefined);
  } else {
    res.status(400).json({ error: 'action must be pause or resume' });
    return;
  }
  res.json({ state, summary: outreachControlSummary(state) });
});

aivaOutreachRouter.get('/scheduler/health', async (_req: OutreachRequest, res: Response) => {
  try {
    const { getSchedulerHealth, isOutreachDurableSchedulerEnabled } = await import(
      '../outreach/scheduler/due-job-queue.js'
    );
    if (!isOutreachDurableSchedulerEnabled()) {
      res.json({ durableEnabled: false, note: 'Durable scheduler disabled; legacy Croner sweep active' });
      return;
    }
    const health = await getSchedulerHealth();
    res.json({ health });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/observability', async (req: OutreachRequest, res: Response) => {
  try {
    const { getOutreachObservabilitySnapshot } = await import('../outreach/observability/snapshot.js');
    const snapshot = await getOutreachObservabilitySnapshot(req.workspaceId);
    res.json({ snapshot });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/test-mode', (req: OutreachRequest, res: Response) => {
  void import('../outreach/test-mode.js').then(({ getOutreachTestModeStatus }) => {
    res.json(getOutreachTestModeStatus(req.workspaceId));
  }).catch((err) => {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  });
});

aivaOutreachRouter.post('/smoke/provider', async (req: OutreachRequest, res: Response) => {
  try {
    const mode = req.body?.mode === 'live' ? 'live' : 'simulated';
    if (mode === 'live' && process.env.CARINA_OUTREACH_ALLOW_LIVE_SMOKE !== 'true') {
      res.status(403).json({
        error: 'live smoke disabled',
        note: 'Set CARINA_OUTREACH_ALLOW_LIVE_SMOKE=true and an allowlist to enable',
      });
      return;
    }
    const { runProviderBackedSmoke } = await import('../outreach/provider-smoke.js');
    const report = await runProviderBackedSmoke({
      workspaceId: typeof req.body?.workspaceId === 'string' ? req.body.workspaceId : `ws-outreach-smoke-${req.workspaceId}`,
      mode,
      recipientEmail: typeof req.body?.recipientEmail === 'string' ? req.body.recipientEmail : undefined,
    });
    res.status(report.ok ? 200 : 500).json({ report });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/scheduler/control', async (req: OutreachRequest, res: Response) => {
  try {
    const { setSchedulerControl, isOutreachDurableSchedulerEnabled } = await import(
      '../outreach/scheduler/due-job-queue.js'
    );
    if (!isOutreachDurableSchedulerEnabled()) {
      res.status(503).json({ error: 'Durable scheduler is not enabled' });
      return;
    }
    const action = String(req.body?.action ?? '').trim().toLowerCase();
    const actor = String(req.body?.updatedBy ?? req.headers['x-user-id'] ?? 'workspace_owner').trim();
    const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
    let patch: { paused?: boolean; drainMode?: boolean };
    if (action === 'pause') patch = { paused: true };
    else if (action === 'resume') patch = { paused: false, drainMode: false };
    else if (action === 'drain') patch = { drainMode: true };
    else if (action === 'undrain') patch = { drainMode: false };
    else {
      res.status(400).json({ error: 'action must be pause, resume, drain, or undrain' });
      return;
    }
    const control = await setSchedulerControl({ ...patch, updatedBy: actor, reason });
    res.json({ control });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/scheduler/dead-letters', async (req: OutreachRequest, res: Response) => {
  try {
    const { listDeadLetterJobs, isOutreachDurableSchedulerEnabled } = await import(
      '../outreach/scheduler/due-job-queue.js'
    );
    if (!isOutreachDurableSchedulerEnabled()) {
      res.json({ jobs: [] });
      return;
    }
    const limit = Number(req.query.limit ?? 50);
    const jobs = await listDeadLetterJobs(Number.isFinite(limit) ? limit : 50);
    const workspaceId = req.workspaceId!;
    res.json({ jobs: jobs.filter((j) => j.workspaceId === workspaceId) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/scheduler/dead-letters/:jobId/replay', async (req: OutreachRequest, res: Response) => {
  try {
    const { listDeadLetterJobs, replayDeadLetterJob, isOutreachDurableSchedulerEnabled } = await import(
      '../outreach/scheduler/due-job-queue.js'
    );
    if (!isOutreachDurableSchedulerEnabled()) {
      res.status(503).json({ error: 'Durable scheduler is not enabled' });
      return;
    }
    const jobId = String(req.params.jobId ?? '');
    const actor = String(req.body?.updatedBy ?? req.headers['x-user-id'] ?? 'workspace_owner').trim();
    const dead = await listDeadLetterJobs(200);
    const match = dead.find((j) => j.id === jobId && j.workspaceId === req.workspaceId!);
    if (!match) {
      res.status(404).json({ error: 'Dead-letter job not found in this workspace' });
      return;
    }
    const job = await replayDeadLetterJob(jobId, actor);
    res.json({ job });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/scheduler/tick', async (_req: OutreachRequest, res: Response) => {
  try {
    const { tickOutreachDueEngine } = await import('../outreach/scheduler/engine.js');
    const { isOutreachDurableSchedulerEnabled } = await import('../outreach/scheduler/due-job-queue.js');
    if (!isOutreachDurableSchedulerEnabled()) {
      res.status(503).json({ error: 'Durable scheduler is not enabled' });
      return;
    }
    const result = await tickOutreachDueEngine();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/mailbox/tick', async (req: OutreachRequest, res: Response) => {
  try {
    const { tickMailboxReplyIngest, isMailboxReplyIngestEnabled } = await import(
      '../outreach/inbound/engine.js'
    );
    if (!isMailboxReplyIngestEnabled()) {
      res.status(503).json({ error: 'Mailbox reply ingest is not enabled' });
      return;
    }
    const workerId = typeof req.body?.workerId === 'string' ? req.body.workerId.trim() : '';
    if (workerId) {
      const { pollGmailMailboxForOutreach } = await import('../outreach/inbound/gmail-poller.js');
      const result = await pollGmailMailboxForOutreach({
        workspaceId: req.workspaceId!,
        workerId,
      });
      res.json({ scoped: true, ...result, ok: result.ok !== false });
      return;
    }
    const result = await tickMailboxReplyIngest();
    res.json({ ...result, ok: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/provider-events', async (req: OutreachRequest, res: Response) => {
  try {
    const { listProviderEvents } = await import('../outreach/provider-events/persist.js');
    const deliveryId = typeof req.query.deliveryId === 'string' ? req.query.deliveryId : undefined;
    const limit = Number(req.query.limit ?? 50);
    const events = await listProviderEvents({
      workspaceId: req.workspaceId!,
      deliveryId,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    res.json({ events });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/reconcile/gaps', async (req: OutreachRequest, res: Response) => {
  try {
    const { listOpenReconcileGaps } = await import('../outreach/provider-events/persist.js');
    const limit = Number(req.query.limit ?? 50);
    const gaps = await listOpenReconcileGaps(Number.isFinite(limit) ? limit : 50);
    const workspaceId = req.workspaceId!;
    res.json({
      gaps: gaps.filter((g) => !g.workspace_id || String(g.workspace_id) === workspaceId),
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/reconcile/tick', async (_req: OutreachRequest, res: Response) => {
  try {
    const { tickDeliveryReconciliation } = await import('../outreach/provider-events/engine.js');
    const { isDeliveryReconcileEnabled } = await import('../outreach/provider-events/reconcile.js');
    if (!isDeliveryReconcileEnabled()) {
      res.status(503).json({ error: 'Delivery reconciliation is not enabled' });
      return;
    }
    const result = await tickDeliveryReconciliation();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.get('/bookings', (req: OutreachRequest, res: Response) => {
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({
    bookings: listBookings(req.workspaceId!, {
      leadId,
      status: status as never,
    }),
  });
});

aivaOutreachRouter.post('/bookings', (req: OutreachRequest, res: Response) => {
  try {
    const booking = createBooking({
      workspaceId: req.workspaceId!,
      leadId: String(req.body?.leadId ?? '').trim(),
      startsAt: String(req.body?.startsAt ?? '').trim(),
      endsAt: String(req.body?.endsAt ?? '').trim(),
      kind: typeof req.body?.kind === 'string' ? req.body.kind : undefined,
      timezone: typeof req.body?.timezone === 'string' ? req.body.timezone : undefined,
      hostEmail: typeof req.body?.hostEmail === 'string' ? req.body.hostEmail : undefined,
      hostName: typeof req.body?.hostName === 'string' ? req.body.hostName : undefined,
      joinLink: typeof req.body?.joinLink === 'string' ? req.body.joinLink : undefined,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
      busyWindows: Array.isArray(req.body?.busyWindows) ? req.body.busyWindows : undefined,
    });
    res.status(201).json({
      booking,
      note: 'Confirmation is pending Soft Wall approval before email send.',
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/reschedule', (req: OutreachRequest, res: Response) => {
  try {
    const booking = rescheduleBooking({
      workspaceId: req.workspaceId!,
      bookingId: routeParam(req.params.bookingId),
      startsAt: String(req.body?.startsAt ?? '').trim(),
      endsAt: String(req.body?.endsAt ?? '').trim(),
      busyWindows: Array.isArray(req.body?.busyWindows) ? req.body.busyWindows : undefined,
    });
    res.json({ booking });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/cancel', (req: OutreachRequest, res: Response) => {
  try {
    const booking = cancelBooking(
      req.workspaceId!,
      routeParam(req.params.bookingId),
      typeof req.body?.reason === 'string' ? req.body.reason : undefined,
    );
    res.json({ booking });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/no-show', (req: OutreachRequest, res: Response) => {
  try {
    const booking = markBookingNoShow(req.workspaceId!, routeParam(req.params.bookingId));
    res.json({ booking });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/attended', (req: OutreachRequest, res: Response) => {
  try {
    const booking = markBookingAttended(req.workspaceId!, routeParam(req.params.bookingId));
    res.json({ booking });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/outcome', (req: OutreachRequest, res: Response) => {
  try {
    const outcome = String(req.body?.outcome ?? '').trim();
    const allowed = ['qualified', 'proposal_needed', 'needs_follow_up', 'not_a_fit', 'won', 'lost'];
    if (!allowed.includes(outcome)) {
      res.status(400).json({ error: 'outcome is required' });
      return;
    }
    const result = recordPostCallOutcome({
      workspaceId: req.workspaceId!,
      bookingId: routeParam(req.params.bookingId),
      outcome: outcome as never,
      notes: typeof req.body?.notes === 'string' ? req.body.notes : undefined,
    });
    res.json({ ...result, note: 'Outcome recorded and follow-up tasks refreshed.' });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

aivaOutreachRouter.post('/bookings/:bookingId/confirmation-sent', (req: OutreachRequest, res: Response) => {
  const booking = markBookingConfirmationSent(req.workspaceId!, routeParam(req.params.bookingId));
  if (!booking) {
    res.status(404).json({ error: 'Booking not found' });
    return;
  }
  res.json({ booking });
});

aivaOutreachRouter.get('/follow-ups', (req: OutreachRequest, res: Response) => {
  res.json({
    tasks: listFollowUpTasks(req.workspaceId!),
    digest: buildWeeklyOwnerDigest(req.workspaceId!),
  });
});

aivaOutreachRouter.post('/follow-ups/process-due', async (req: OutreachRequest, res: Response) => {
  const result = await processDueFollowUps(req.workspaceId!);
  res.json({
    ...result,
    digest: buildWeeklyOwnerDigest(req.workspaceId!),
  });
});

aivaOutreachRouter.get('/reminders', (req: OutreachRequest, res: Response) => {
  const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({
    reminders: listReminders(req.workspaceId!, {
      bookingId,
      status: status as never,
    }),
  });
});

aivaOutreachRouter.post('/reminders/process-due', (req: OutreachRequest, res: Response) => {
  const result = processDueReminders(req.workspaceId!);
  res.json({
    ...result,
    note: 'Reminder bodies are logged for Soft Wall / Approvals; they are not mass-sent.',
  });
});
