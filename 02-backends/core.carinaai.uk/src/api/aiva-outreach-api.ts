import { Router, type Request, type Response, type Router as ExpressRouter } from 'express';
import { requireCloudProxy } from '../gateway/cloud-proxy-auth.js';
import {
  addLeadsToList,
  createCampaign,
  createLead,
  createLeadList,
  createSequence,
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
import { buildOutreachCadenceSummary } from '../outreach/cadence.js';
import { isPipelineStatus } from '../outreach/pipeline.js';
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
  });
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

aivaOutreachRouter.get('/leads', (req: OutreachRequest, res: Response) => {
  const campaignId = typeof req.query.campaignId === 'string' ? req.query.campaignId : undefined;
  const status = typeof req.query.status === 'string' && isPipelineStatus(req.query.status)
    ? req.query.status
    : undefined;
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  res.json({
    leads: listLeads(req.workspaceId!, {
      campaignId,
      status,
      source: source as never,
      tag,
    }),
  });
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
  const rows = Array.isArray(req.body?.leads) ? req.body.leads : [];
  if (rows.length === 0) {
    res.status(400).json({ error: 'leads array is required' });
    return;
  }
  const result = importLeadBatch(
    req.workspaceId!,
    rows.map((row: Record<string, unknown>) => ({
      name: String(row.name ?? '').trim() || 'Unknown',
      email: typeof row.email === 'string' ? row.email : undefined,
      phone: typeof row.phone === 'string' ? row.phone : undefined,
      company: typeof row.company === 'string' ? row.company : undefined,
      source: typeof row.source === 'string' ? (row.source as never) : 'csv_import',
      campaignId: typeof row.campaignId === 'string' ? row.campaignId : undefined,
      tags: Array.isArray(row.tags) ? row.tags.map(String) : undefined,
    })),
  );
  res.status(201).json(result);
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

aivaOutreachRouter.patch('/leads/:leadId', (req: OutreachRequest, res: Response) => {
  const lead = updateLead(req.workspaceId!, routeParam(req.params.leadId), {
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
  });
  if (!lead) {
    res.status(404).json({ error: 'Lead not found' });
    return;
  }
  res.json({ lead });
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

aivaOutreachRouter.get('/replies/review', (req: OutreachRequest, res: Response) => {
  const status = typeof req.query.status === 'string' && (req.query.status === 'open' || req.query.status === 'resolved')
    ? req.query.status
    : undefined;
  res.json({ reviews: listReplyReviews(req.workspaceId!, status ? { status } : undefined) });
});

aivaOutreachRouter.post('/replies/inbound', (req: OutreachRequest, res: Response) => {
  const fromEmail = String(req.body?.fromEmail ?? req.body?.from ?? '').trim();
  const subject = String(req.body?.subject ?? '').trim();
  const body = String(req.body?.body ?? req.body?.text ?? '').trim();
  if (!fromEmail || !subject || !body) {
    res.status(400).json({ error: 'fromEmail, subject, and body are required' });
    return;
  }
  const result = processInboundReply({
    workspaceId: req.workspaceId!,
    fromEmail,
    subject,
    body,
    sourceMessageId: typeof req.body?.sourceMessageId === 'string' ? req.body.sourceMessageId : undefined,
    inReplyTo: typeof req.body?.inReplyTo === 'string' ? req.body.inReplyTo : undefined,
    threadId: typeof req.body?.threadId === 'string' ? req.body.threadId : undefined,
    receivedAt: typeof req.body?.receivedAt === 'string' ? req.body.receivedAt : undefined,
  });
  res.status(201).json(result);
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

aivaOutreachRouter.get('/enrollments', (req: OutreachRequest, res: Response) => {
  const leadId = typeof req.query.leadId === 'string' ? req.query.leadId : undefined;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json({
    enrollments: listEnrollments(req.workspaceId!, {
      leadId,
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
