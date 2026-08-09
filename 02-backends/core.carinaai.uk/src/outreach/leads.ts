import crypto from 'crypto';
import { findDuplicateLeadId, normalizeEmail, normalizePhone } from './dedupe.js';
import { appendTimeline, isPipelineStatus, transitionLeadStatus } from './pipeline.js';
import { refreshFollowUpPlans } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import { hydrateLeadCompat, ingestLeads } from './lead-ingest.js';
import type {
  BookingState,
  LeadList,
  LeadSource,
  OutreachCampaign,
  OutreachLead,
  PipelineStatus,
  ReplyState,
} from './types.js';

function nowIso(): string {
  return new Date().toISOString();
}

export function listLeads(workspaceId: string, filter?: {
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
}): OutreachLead[] {
  let leads = loadOutreachStore().leads.filter((l) => l.workspaceId === workspaceId);
  if (filter?.campaignId) leads = leads.filter((l) => l.campaignId === filter.campaignId || l.campaignIds?.includes(filter.campaignId!));
  if (filter?.status) leads = leads.filter((l) => l.status === filter.status || l.pipelineStage === filter.status);
  if (filter?.source) {
    leads = leads.filter((l) => l.source === filter.source || l.sourceType === filter.source);
  }
  if (filter?.tag) leads = leads.filter((l) => l.tags.includes(filter.tag!));
  if (filter?.niche) {
    const niche = filter.niche.toLowerCase();
    leads = leads.filter((l) => (l.niche || '').toLowerCase().includes(niche));
  }
  if (filter?.priority) {
    leads = leads.filter((l) => String(l.priority || '').toLowerCase() === filter.priority!.toLowerCase());
  }
  if (filter?.townCity) {
    const town = filter.townCity.toLowerCase();
    leads = leads.filter((l) => (l.townCity || '').toLowerCase().includes(town));
  }
  if (filter?.hasEmail === true) leads = leads.filter((l) => Boolean(l.email));
  if (filter?.hasEmail === false) leads = leads.filter((l) => !l.email);
  if (filter?.replied === true) leads = leads.filter((l) => l.replyState === 'replied' || Boolean(l.lastReplyAt));
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    leads = leads.filter((l) =>
      [l.name, l.contactName, l.email, l.company, l.niche, l.townCity, l.website, l.notes, l.source, l.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q));
  }
  return leads
    .map(hydrateLeadCompat)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLead(workspaceId: string, leadId: string): OutreachLead | null {
  const lead = loadOutreachStore().leads.find((l) => l.workspaceId === workspaceId && l.id === leadId) ?? null;
  return lead ? hydrateLeadCompat(lead) : null;
}

export function createLead(input: {
  workspaceId: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  companyNumber?: string;
  source?: LeadSource;
  campaignId?: string;
  owner?: string;
  notes?: string;
  tags?: string[];
  timezone?: string;
  youtubeLeadId?: string;
  youtubeChannelId?: string;
  niche?: string;
  townCity?: string;
  website?: string;
  contactName?: string;
  googleReviews?: number;
  googleRating?: number;
  googleMapsUrl?: string;
  websiteScore?: number;
  ranksTop3?: boolean | string;
  weakness?: string;
  priority?: string;
  sourceType?: LeadSource;
  sourceName?: string;
  sourceUrl?: string;
  ownerWorkerId?: string;
  customFields?: Record<string, unknown>;
  overwrite?: boolean;
}): { lead: OutreachLead; duplicateOf?: string } {
  const result = ingestLeads({
    workspaceId: input.workspaceId,
    kind: 'api',
    sourceType: input.sourceType ?? input.source ?? 'manual',
    sourceName: input.sourceName,
    sourceUrl: input.sourceUrl,
    ownerWorkerId: input.ownerWorkerId || input.owner,
    campaignId: input.campaignId,
    overwrite: input.overwrite,
    rows: [{
      contactName: input.contactName || input.name,
      name: input.name,
      email: input.email,
      phone: input.phone,
      company: input.company,
      companyNumber: input.companyNumber,
      niche: input.niche ?? input.tags?.[0],
      townCity: input.townCity,
      website: input.website,
      googleReviews: input.googleReviews,
      googleRating: input.googleRating,
      googleMapsUrl: input.googleMapsUrl,
      websiteScore: input.websiteScore,
      ranksTop3: input.ranksTop3,
      weakness: input.weakness,
      priority: input.priority,
      notes: input.notes,
      ...(input.customFields ?? {}),
    }],
  });
  let lead = result.leads[0];
  if (!lead) throw new Error('Lead create failed');

  if (input.youtubeLeadId || input.timezone || (input.tags && input.tags.length > 0)) {
    mutateOutreachStore((s) => {
      const idx = s.leads.findIndex((l) => l.id === lead!.id && l.workspaceId === input.workspaceId);
      if (idx < 0) return;
      const cur = s.leads[idx]!;
      s.leads[idx] = {
        ...cur,
        youtubeLeadId: input.youtubeLeadId ?? cur.youtubeLeadId,
        youtubeChannelId: input.youtubeChannelId ?? cur.youtubeChannelId,
        timezone: input.timezone ?? cur.timezone,
        tags: Array.from(new Set([...(cur.tags ?? []), ...(input.tags ?? [])])),
        updatedAt: nowIso(),
      };
      lead = s.leads[idx]!;
    });
  }

  const wasNew = result.created > 0;
  return {
    lead: hydrateLeadCompat(lead),
    duplicateOf: wasNew ? undefined : lead.id,
  };
}

export function updateLead(
  workspaceId: string,
  leadId: string,
  patch: Partial<{
    name: string;
    email: string;
    phone: string;
    company: string;
    campaignId: string;
    owner: string;
    notes: string;
    tags: string[];
    timezone: string;
    status: PipelineStatus;
    replyState: ReplyState;
    bookingState: BookingState;
    nextActionAt: string | null;
    niche: string;
    townCity: string;
    website: string;
    contactName: string;
    googleReviews: number | null;
    googleRating: number | null;
    googleMapsUrl: string;
    websiteScore: number | null;
    ranksTop3: boolean | string | null;
    weakness: string;
    priority: string;
    sourceUrl: string;
    sourceName: string;
    pipelineStage: string;
    consentStatus: string;
    suppressionReason: string;
    ownerWorkerId: string;
    listIds: string[];
    campaignIds: string[];
    sequenceId: string | null;
    customFields: Record<string, unknown>;
    archivedAt: string | null;
  }>,
): OutreachLead | null {
  const existing = getLead(workspaceId, leadId);
  if (!existing) return null;

  let lead = existing;
  if (patch.status && isPipelineStatus(patch.status) && patch.status !== lead.status) {
    lead = transitionLeadStatus(lead, patch.status);
  }
  if (patch.name !== undefined) lead = { ...lead, name: patch.name.trim() || lead.name };
  if (patch.contactName !== undefined) {
    lead = { ...lead, contactName: patch.contactName.trim() || lead.contactName, name: patch.contactName.trim() || lead.name };
  }
  if (patch.email !== undefined) lead = { ...lead, email: normalizeEmail(patch.email) };
  if (patch.phone !== undefined) lead = { ...lead, phone: normalizePhone(patch.phone) };
  if (patch.company !== undefined) lead = { ...lead, company: patch.company.trim() || undefined };
  if (patch.campaignId !== undefined) lead = { ...lead, campaignId: patch.campaignId || undefined };
  if (patch.owner !== undefined) lead = { ...lead, owner: patch.owner.trim() || undefined };
  if (patch.ownerWorkerId !== undefined) lead = { ...lead, ownerWorkerId: patch.ownerWorkerId.trim() || undefined };
  if (patch.notes !== undefined) lead = { ...lead, notes: patch.notes };
  if (patch.tags !== undefined) lead = { ...lead, tags: patch.tags };
  if (patch.timezone !== undefined) lead = { ...lead, timezone: patch.timezone || undefined };
  if (patch.replyState !== undefined) lead = { ...lead, replyState: patch.replyState };
  if (patch.bookingState !== undefined) lead = { ...lead, bookingState: patch.bookingState };
  if (patch.nextActionAt !== undefined) {
    lead = { ...lead, nextActionAt: patch.nextActionAt || undefined };
  }
  if (patch.niche !== undefined) lead = { ...lead, niche: patch.niche.trim() || undefined };
  if (patch.townCity !== undefined) lead = { ...lead, townCity: patch.townCity.trim() || undefined };
  if (patch.website !== undefined) lead = { ...lead, website: patch.website.trim() || undefined };
  if (patch.googleMapsUrl !== undefined) lead = { ...lead, googleMapsUrl: patch.googleMapsUrl.trim() || undefined };
  if (patch.googleReviews !== undefined) lead = { ...lead, googleReviews: patch.googleReviews ?? undefined };
  if (patch.googleRating !== undefined) lead = { ...lead, googleRating: patch.googleRating ?? undefined };
  if (patch.websiteScore !== undefined) lead = { ...lead, websiteScore: patch.websiteScore ?? undefined };
  if (patch.ranksTop3 !== undefined) lead = { ...lead, ranksTop3: patch.ranksTop3 ?? undefined };
  if (patch.weakness !== undefined) lead = { ...lead, weakness: patch.weakness.trim() || undefined };
  if (patch.priority !== undefined) lead = { ...lead, priority: patch.priority.trim() || undefined };
  if (patch.sourceUrl !== undefined) lead = { ...lead, sourceUrl: patch.sourceUrl.trim() || undefined };
  if (patch.sourceName !== undefined) lead = { ...lead, sourceName: patch.sourceName.trim() || undefined };
  if (patch.pipelineStage !== undefined) lead = { ...lead, pipelineStage: patch.pipelineStage.trim() || undefined };
  if (patch.consentStatus !== undefined) {
    lead = { ...lead, consentStatus: patch.consentStatus as OutreachLead['consentStatus'] };
  }
  if (patch.suppressionReason !== undefined) {
    lead = { ...lead, suppressionReason: patch.suppressionReason.trim() || undefined };
  }
  if (patch.listIds !== undefined) lead = { ...lead, listIds: patch.listIds };
  if (patch.campaignIds !== undefined) lead = { ...lead, campaignIds: patch.campaignIds };
  if (patch.sequenceId !== undefined) lead = { ...lead, sequenceId: patch.sequenceId || undefined };
  if (patch.archivedAt !== undefined) lead = { ...lead, archivedAt: patch.archivedAt || undefined };
  if (patch.customFields !== undefined) {
    lead = { ...lead, customFields: { ...(lead.customFields ?? {}), ...patch.customFields } };
  }
  lead = { ...lead, updatedAt: nowIso() };

  mutateOutreachStore((s) => {
    const idx = s.leads.findIndex((l) => l.id === leadId);
    if (idx >= 0) s.leads[idx] = lead;
  });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, leadId, 'Lead updated').catch(() => undefined);
  void import('./store.js').then(({ flushOutreachStoreAsync }) => flushOutreachStoreAsync()).catch(() => undefined);
  return hydrateLeadCompat(lead);
}

export function deleteLead(workspaceId: string, leadId: string): boolean {
  const existing = getLead(workspaceId, leadId);
  if (!existing) return false;
  mutateOutreachStore((s) => {
    s.leads = s.leads.filter((l) => !(l.workspaceId === workspaceId && l.id === leadId));
    s.enrollments = (s.enrollments ?? []).filter(
      (e) => !(e.workspaceId === workspaceId && e.leadId === leadId),
    );
    s.deliveries = (s.deliveries ?? []).filter(
      (d) => !(d.workspaceId === workspaceId && d.leadId === leadId),
    );
    s.lists = (s.lists ?? []).map((list) => {
      if (list.workspaceId !== workspaceId) return list;
      return {
        ...list,
        leadIds: list.leadIds.filter((id) => id !== leadId),
        updatedAt: nowIso(),
      };
    });
  });
  void refreshFollowUpPlans(workspaceId);
  return true;
}

export function importLeadBatch(
  workspaceId: string,
  rows: Array<{
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    companyNumber?: string;
    source?: LeadSource;
    campaignId?: string;
    tags?: string[];
    niche?: string;
    townCity?: string;
    website?: string;
    contactName?: string;
    notes?: string;
    [key: string]: unknown;
  }>,
): { created: OutreachLead[]; duplicates: OutreachLead[]; ingest?: ReturnType<typeof ingestLeads> } {
  const ingest = ingestLeads({
    workspaceId,
    kind: 'import',
    sourceType: 'csv_import',
    rows: rows.map((row) => ({
      ...row,
      contactName: row.contactName || row.name,
      niche: row.niche ?? row.tags?.[0],
      sourceType: row.source ?? 'csv_import',
    })),
  });
  const createdIds = new Set(
    ingest.rowResults.filter((r) => r.outcome === 'created' && r.leadId).map((r) => r.leadId!),
  );
  const dupIds = new Set(
    ingest.rowResults
      .filter((r) => (r.outcome === 'duplicate' || r.outcome === 'updated') && r.leadId)
      .map((r) => r.leadId!),
  );
  return {
    created: ingest.leads.filter((l) => createdIds.has(l.id)),
    duplicates: ingest.leads.filter((l) => dupIds.has(l.id) && !createdIds.has(l.id)),
    ingest,
  };
}

export function listCampaigns(workspaceId: string): OutreachCampaign[] {
  return loadOutreachStore().campaigns.filter((c) => c.workspaceId === workspaceId);
}

export function getCampaign(workspaceId: string, campaignId: string): OutreachCampaign | null {
  return listCampaigns(workspaceId).find((c) => c.id === campaignId) ?? null;
}

export function createCampaign(input: {
  workspaceId: string;
  name: string;
  objective?: string;
  sourceType?: OutreachCampaign['sourceType'];
  targetAudience?: string;
  dailyCap?: number;
  timezone?: string;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  businessDays?: number[];
  weeklyTarget?: number;
  fromEmail?: string;
  requireApproval?: boolean;
  warmupDays?: number;
  defaultBookingLink?: string;
  defaultSequenceId?: string;
}): OutreachCampaign {
  const stamp = nowIso();
  const campaign: OutreachCampaign = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Untitled campaign',
    objective: input.objective?.trim() || '',
    sourceType: input.sourceType ?? 'mixed',
    targetAudience: input.targetAudience?.trim() || '',
    active: true,
    cadence: {
      dailyCap: Math.max(1, input.dailyCap ?? 10),
      timezone: input.timezone ?? 'Europe/London',
      businessHoursStart: input.businessHoursStart ?? '09:00',
      businessHoursEnd: input.businessHoursEnd ?? '17:00',
      businessDays: input.businessDays ?? [1, 2, 3, 4, 5],
      weeklyTarget: input.weeklyTarget != null ? Math.max(1, input.weeklyTarget) : undefined,
      fromEmail: input.fromEmail?.trim() || undefined,
      requireApproval: input.requireApproval ?? true,
      warmupDays: input.warmupDays != null ? Math.max(0, Math.floor(input.warmupDays)) : 14,
    },
    defaultBookingLink: input.defaultBookingLink,
    defaultSequenceId: input.defaultSequenceId,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateOutreachStore((s) => {
    s.campaigns.push(campaign);
  });
  return campaign;
}

export function updateCampaign(
  workspaceId: string,
  campaignId: string,
  patch: Partial<{
    name: string;
    objective: string;
    targetAudience: string;
    active: boolean;
    dailyCap: number;
    timezone: string;
    businessHoursStart: string;
    businessHoursEnd: string;
    businessDays: number[];
    weeklyTarget: number | null;
    fromEmail: string | null;
    requireApproval: boolean;
    warmupDays: number | null;
    defaultBookingLink: string;
    defaultSequenceId: string;
  }>,
): OutreachCampaign | null {
  const existing = getCampaign(workspaceId, campaignId);
  if (!existing) return null;
  const campaign: OutreachCampaign = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
    objective: patch.objective !== undefined ? patch.objective : existing.objective,
    targetAudience: patch.targetAudience !== undefined ? patch.targetAudience : existing.targetAudience,
    active: patch.active !== undefined ? patch.active : existing.active,
    defaultBookingLink: patch.defaultBookingLink !== undefined ? patch.defaultBookingLink || undefined : existing.defaultBookingLink,
    defaultSequenceId: patch.defaultSequenceId !== undefined ? patch.defaultSequenceId || undefined : existing.defaultSequenceId,
    cadence: {
      ...existing.cadence,
      dailyCap: patch.dailyCap !== undefined ? Math.max(1, patch.dailyCap) : existing.cadence.dailyCap,
      timezone: patch.timezone ?? existing.cadence.timezone,
      businessHoursStart: patch.businessHoursStart ?? existing.cadence.businessHoursStart,
      businessHoursEnd: patch.businessHoursEnd ?? existing.cadence.businessHoursEnd,
      businessDays: patch.businessDays ?? existing.cadence.businessDays,
      weeklyTarget: patch.weeklyTarget !== undefined
        ? (patch.weeklyTarget === null ? undefined : Math.max(1, patch.weeklyTarget))
        : existing.cadence.weeklyTarget,
      fromEmail: patch.fromEmail !== undefined
        ? (patch.fromEmail?.trim() || undefined)
        : existing.cadence.fromEmail,
      requireApproval: patch.requireApproval !== undefined ? patch.requireApproval : existing.cadence.requireApproval ?? true,
      warmupDays: patch.warmupDays !== undefined
        ? (patch.warmupDays === null ? undefined : Math.max(0, Math.floor(patch.warmupDays)))
        : existing.cadence.warmupDays,
    },
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.campaigns.findIndex((c) => c.id === campaignId);
    if (idx >= 0) s.campaigns[idx] = campaign;
  });
  return campaign;
}

export function deleteCampaign(workspaceId: string, campaignId: string): boolean {
  if (!getCampaign(workspaceId, campaignId)) return false;
  mutateOutreachStore((store) => {
    store.campaigns = store.campaigns.filter(
      (campaign) => !(campaign.workspaceId === workspaceId && campaign.id === campaignId),
    );
    store.leads = store.leads.map((lead) => (
      lead.workspaceId === workspaceId && lead.campaignId === campaignId
        ? { ...lead, campaignId: undefined, updatedAt: nowIso() }
        : lead
    ));
    store.enrollments = store.enrollments.map((enrollment) => (
      enrollment.workspaceId === workspaceId && enrollment.campaignId === campaignId
        ? { ...enrollment, campaignId: undefined, updatedAt: nowIso() }
        : enrollment
    ));
  });
  return true;
}

export function listLeadLists(workspaceId: string): LeadList[] {
  return loadOutreachStore().lists.filter((l) => l.workspaceId === workspaceId);
}

export function createLeadList(input: {
  workspaceId: string;
  name: string;
  description?: string;
  leadIds?: string[];
  tags?: string[];
}): LeadList {
  const stamp = nowIso();
  const list: LeadList = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Untitled list',
    description: input.description,
    leadIds: input.leadIds ?? [],
    tags: input.tags ?? [],
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateOutreachStore((s) => {
    s.lists.push(list);
  });
  return list;
}

export function updateLeadList(
  workspaceId: string,
  listId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    leadIds: string[];
    tags: string[];
  }>,
): LeadList | null {
  const existing = listLeadLists(workspaceId).find((l) => l.id === listId);
  if (!existing) return null;
  const list: LeadList = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() || existing.name : existing.name,
    description: patch.description !== undefined ? (patch.description?.trim() || undefined) : existing.description,
    leadIds: patch.leadIds !== undefined ? Array.from(new Set(patch.leadIds.map(String))) : existing.leadIds,
    tags: patch.tags !== undefined ? Array.from(new Set(patch.tags.map(String))) : existing.tags,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.lists.findIndex((l) => l.id === listId);
    if (idx >= 0) s.lists[idx] = list;
  });
  return list;
}

export function deleteLeadList(workspaceId: string, listId: string): boolean {
  const exists = listLeadLists(workspaceId).some((list) => list.id === listId);
  if (!exists) return false;
  mutateOutreachStore((store) => {
    store.lists = store.lists.filter(
      (list) => !(list.workspaceId === workspaceId && list.id === listId),
    );
  });
  return true;
}

export function addLeadsToList(workspaceId: string, listId: string, leadIds: string[]): LeadList | null {
  const store = loadOutreachStore();
  const list = store.lists.find((l) => l.workspaceId === workspaceId && l.id === listId);
  if (!list) return null;
  const next: LeadList = {
    ...list,
    leadIds: Array.from(new Set([...list.leadIds, ...leadIds])),
    updatedAt: nowIso(),
  };
  mutateOutreachStore((s) => {
    const idx = s.lists.findIndex((l) => l.id === listId);
    if (idx >= 0) s.lists[idx] = next;
  });
  return next;
}

export function pipelineSummary(workspaceId: string): Record<PipelineStatus | 'total', number> {
  const leads = listLeads(workspaceId);
  const summary = {
    total: leads.length,
    new: 0,
    contacted: 0,
    replied: 0,
    booked: 0,
    attended: 0,
    proposal_sent: 0,
    won: 0,
    lost: 0,
    ghosted: 0,
    follow_up: 0,
  } as Record<PipelineStatus | 'total', number>;
  for (const lead of leads) {
    summary[lead.status] = (summary[lead.status] ?? 0) + 1;
  }
  return summary;
}
