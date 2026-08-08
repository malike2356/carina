import crypto from 'crypto';
import { findDuplicateLeadId, normalizeEmail, normalizePhone } from './dedupe.js';
import { appendTimeline, isPipelineStatus, transitionLeadStatus } from './pipeline.js';
import { refreshFollowUpPlans } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
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
}): OutreachLead[] {
  let leads = loadOutreachStore().leads.filter((l) => l.workspaceId === workspaceId);
  if (filter?.campaignId) leads = leads.filter((l) => l.campaignId === filter.campaignId);
  if (filter?.status) leads = leads.filter((l) => l.status === filter.status);
  if (filter?.source) leads = leads.filter((l) => l.source === filter.source);
  if (filter?.tag) leads = leads.filter((l) => l.tags.includes(filter.tag!));
  return leads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getLead(workspaceId: string, leadId: string): OutreachLead | null {
  return loadOutreachStore().leads.find((l) => l.workspaceId === workspaceId && l.id === leadId) ?? null;
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
}): { lead: OutreachLead; duplicateOf?: string } {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const companyNumber = String(input.companyNumber ?? '').trim().toUpperCase() || undefined;
  const store = loadOutreachStore();
  const workspaceLeads = store.leads.filter((l) => l.workspaceId === input.workspaceId);
  const duplicateOf = findDuplicateLeadId(workspaceLeads, { email, phone, companyNumber });

  if (duplicateOf) {
    let primary = workspaceLeads.find((l) => l.id === duplicateOf)!;
    primary = appendTimeline(primary, {
      kind: 'import',
      message: `Duplicate intake linked (matched ${email ? 'email' : 'phone'} for ${input.name})`,
      meta: { name: input.name },
    });
    if (input.youtubeLeadId && !primary.youtubeLeadId) {
      primary = { ...primary, youtubeLeadId: input.youtubeLeadId, youtubeChannelId: input.youtubeChannelId };
    }
    if (input.tags?.length) {
      primary = { ...primary, tags: Array.from(new Set([...primary.tags, ...input.tags])) };
    }
    if (!primary.linkedLeadIds.includes(duplicateOf)) {
      // keep structure; no new id for duplicate create
    }
    mutateOutreachStore((s) => {
      const idx = s.leads.findIndex((l) => l.id === primary.id);
      if (idx >= 0) s.leads[idx] = primary;
    });
    return { lead: primary, duplicateOf };
  }

  const stamp = nowIso();
  let lead: OutreachLead = {
    id: crypto.randomUUID(),
    workspaceId: input.workspaceId,
    name: input.name.trim() || 'Unknown',
    email,
    phone,
    company: input.company?.trim() || undefined,
    companyNumber,
    source: input.source ?? 'manual',
    campaignId: input.campaignId,
    status: 'new',
    owner: input.owner?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    tags: input.tags ?? [],
    timezone: input.timezone,
    replyState: 'none',
    bookingState: 'none',
    linkedLeadIds: [],
    youtubeLeadId: input.youtubeLeadId,
    youtubeChannelId: input.youtubeChannelId,
    createdAt: stamp,
    updatedAt: stamp,
    timeline: [],
  };
  lead = appendTimeline(lead, {
    kind: 'system',
    message: `Lead created from ${lead.source}`,
    toStatus: 'new',
  });

  mutateOutreachStore((s) => {
    s.leads.push(lead);
  });
  void refreshFollowUpPlans(input.workspaceId);
  void syncLeadBoardState(input.workspaceId, lead.id, 'Lead created').catch(() => undefined);
  return { lead };
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
  }>,
): OutreachLead | null {
  const existing = getLead(workspaceId, leadId);
  if (!existing) return null;

  let lead = existing;
  if (patch.status && isPipelineStatus(patch.status) && patch.status !== lead.status) {
    lead = transitionLeadStatus(lead, patch.status);
  }
  if (patch.name !== undefined) lead = { ...lead, name: patch.name.trim() || lead.name };
  if (patch.email !== undefined) lead = { ...lead, email: normalizeEmail(patch.email) };
  if (patch.phone !== undefined) lead = { ...lead, phone: normalizePhone(patch.phone) };
  if (patch.company !== undefined) lead = { ...lead, company: patch.company.trim() || undefined };
  if (patch.campaignId !== undefined) lead = { ...lead, campaignId: patch.campaignId || undefined };
  if (patch.owner !== undefined) lead = { ...lead, owner: patch.owner.trim() || undefined };
  if (patch.notes !== undefined) lead = { ...lead, notes: patch.notes };
  if (patch.tags !== undefined) lead = { ...lead, tags: patch.tags };
  if (patch.timezone !== undefined) lead = { ...lead, timezone: patch.timezone || undefined };
  if (patch.replyState !== undefined) lead = { ...lead, replyState: patch.replyState };
  if (patch.bookingState !== undefined) lead = { ...lead, bookingState: patch.bookingState };
  if (patch.nextActionAt !== undefined) {
    lead = { ...lead, nextActionAt: patch.nextActionAt || undefined };
  }
  lead = { ...lead, updatedAt: nowIso() };

  mutateOutreachStore((s) => {
    const idx = s.leads.findIndex((l) => l.id === leadId);
    if (idx >= 0) s.leads[idx] = lead;
  });
  void refreshFollowUpPlans(workspaceId);
  void syncLeadBoardState(workspaceId, leadId, 'Lead updated').catch(() => undefined);
  return lead;
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
  }>,
): { created: OutreachLead[]; duplicates: OutreachLead[] } {
  const created: OutreachLead[] = [];
  const duplicates: OutreachLead[] = [];
  for (const row of rows) {
    const result = createLead({
      workspaceId,
      name: row.name,
      email: row.email,
      phone: row.phone,
    company: row.company,
    companyNumber: row.companyNumber,
    source: row.source ?? 'csv_import',
      campaignId: row.campaignId,
      tags: row.tags,
    });
    if (result.duplicateOf) duplicates.push(result.lead);
    else created.push(result.lead);
  }
  return { created, duplicates };
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
