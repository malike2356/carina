/** Unified lead ingestion: alias map, provenance, dedupe, merge, job audit. */

import crypto from 'crypto';
import { mapRowAliases } from './lead-aliases.js';
import {
  findDuplicateLeadId,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
  normalizeCompanyLocationKey,
} from './dedupe.js';
import { appendTimeline, isPipelineStatus } from './pipeline.js';
import { refreshFollowUpPlans } from './follow-ups.js';
import { syncLeadBoardState } from './kanban.js';
import { loadOutreachStore, mutateOutreachStore } from './store.js';
import type {
  ConsentStatus,
  LeadIngestJob,
  LeadIngestJobKind,
  LeadIngestRowResult,
  LeadSource,
  LeadSourceType,
  OutreachLead,
  PipelineStatus,
} from './types.js';

const MAX_ROWS = 5_000;
const MAX_COLUMNS = 80;
const MAX_FIELD_CHARS = 4_000;

function nowIso(): string {
  return new Date().toISOString();
}

function asString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text ? text.slice(0, MAX_FIELD_CHARS) : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function asBoolish(value: unknown): boolean | string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  if (['yes', 'y', 'true', '1'].includes(text)) return true;
  if (['no', 'n', 'false', '0'].includes(text)) return false;
  return String(value).trim();
}

function mapLegacySource(sourceType: LeadSourceType | undefined): LeadSource {
  const s = (sourceType ?? 'manual') as LeadSource;
  return s;
}

export interface LeadIngestInputRow {
  [key: string]: unknown;
}

export interface LeadIngestOptions {
  workspaceId: string;
  rows: LeadIngestInputRow[];
  sourceType?: LeadSourceType;
  sourceName?: string;
  sourceUrl?: string;
  sourceJobId?: string;
  ownerWorkerId?: string;
  campaignId?: string;
  listIds?: string[];
  overwrite?: boolean;
  kind?: LeadIngestJobKind;
  persistJob?: boolean;
}

export interface LeadIngestResult {
  created: number;
  updated: number;
  duplicate: number;
  rejected: number;
  warning: number;
  leads: OutreachLead[];
  rowResults: LeadIngestRowResult[];
  jobId?: string;
}

function buildLeadFieldsFromCanonical(
  canonical: Record<string, unknown>,
  customFields: Record<string, unknown>,
  opts: LeadIngestOptions,
): Partial<OutreachLead> & { name: string } {
  const contactName = asString(canonical.contactName) || asString(canonical.name);
  const company = asString(canonical.company);
  const name = contactName || company || 'Unknown';
  const email = normalizeEmail(asString(canonical.email));
  const phone = normalizePhone(asString(canonical.phone));
  const website = normalizeWebsite(asString(canonical.website));
  const sourceType = (asString(canonical.sourceType) as LeadSourceType | undefined)
    || opts.sourceType
    || 'upload';
  const statusRaw = asString(canonical.status);
  const status = statusRaw && isPipelineStatus(statusRaw) ? statusRaw as PipelineStatus : undefined;

  return {
    name,
    contactName: contactName || name,
    company,
    email,
    phone,
    website,
    niche: asString(canonical.niche),
    townCity: asString(canonical.townCity),
    googleReviews: asNumber(canonical.googleReviews),
    googleRating: asNumber(canonical.googleRating),
    googleMapsUrl: asString(canonical.googleMapsUrl),
    websiteScore: asNumber(canonical.websiteScore),
    ranksTop3: asBoolish(canonical.ranksTop3),
    weakness: asString(canonical.weakness),
    priority: asString(canonical.priority),
    notes: asString(canonical.notes),
    dateAdded: asString(canonical.dateAdded),
    companyNumber: asString(canonical.companyNumber)?.toUpperCase(),
    sourceType,
    sourceName: asString(canonical.sourceName) || opts.sourceName,
    sourceUrl: asString(canonical.sourceUrl) || opts.sourceUrl,
    sourceCapturedAt: nowIso(),
    sourceJobId: opts.sourceJobId,
    ownerWorkerId: opts.ownerWorkerId,
    campaignId: opts.campaignId || asString(canonical.campaignId),
    campaignIds: opts.campaignId ? [opts.campaignId] : undefined,
    listIds: opts.listIds,
    pipelineStage: asString(canonical.pipelineStage) || status,
    status,
    consentStatus: (asString(canonical.consentStatus) as ConsentStatus | undefined) || 'unknown',
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    source: mapLegacySource(sourceType),
  };
}

function mergeLeadFields(
  existing: OutreachLead,
  incoming: Partial<OutreachLead>,
  overwrite: boolean,
): OutreachLead {
  const next: OutreachLead = { ...existing };
  const keys = Object.keys(incoming) as Array<keyof OutreachLead>;
  for (const key of keys) {
    if (key === 'id' || key === 'workspaceId' || key === 'createdAt' || key === 'timeline' || key === 'linkedLeadIds') {
      continue;
    }
    const value = incoming[key];
    if (value === undefined || value === null || value === '') continue;
    const current = next[key];
    if (overwrite || current === undefined || current === null || current === '') {
      (next as unknown as Record<string, unknown>)[key as string] = value;
    } else if (key === 'tags' && Array.isArray(value) && Array.isArray(current)) {
      next.tags = Array.from(new Set([...current, ...value]));
    } else if (key === 'listIds' && Array.isArray(value)) {
      next.listIds = Array.from(new Set([...(current as string[] ?? []), ...value]));
    } else if (key === 'campaignIds' && Array.isArray(value)) {
      next.campaignIds = Array.from(new Set([...(current as string[] ?? []), ...value]));
    } else if (key === 'customFields' && typeof value === 'object') {
      next.customFields = { ...(current as Record<string, unknown> ?? {}), ...(value as Record<string, unknown>) };
    }
  }
  if (!next.contactName) next.contactName = next.name;
  if (!next.dateAdded) next.dateAdded = next.createdAt;
  next.updatedAt = nowIso();
  return next;
}

export function ingestLeads(opts: LeadIngestOptions): LeadIngestResult {
  if (!opts.workspaceId?.trim()) {
    throw new Error('workspaceId is required');
  }
  const rows = opts.rows ?? [];
  if (rows.length > MAX_ROWS) {
    throw new Error(`Row limit exceeded (max ${MAX_ROWS})`);
  }

  const stamp = nowIso();
  const jobId = crypto.randomUUID();
  const overwrite = Boolean(opts.overwrite);
  const rowResults: LeadIngestRowResult[] = [];
  const leadsOut: OutreachLead[] = [];
  let created = 0;
  let updated = 0;
  let duplicate = 0;
  let rejected = 0;
  let warning = 0;

  mutateOutreachStore((store) => {
    const workspaceLeads = store.leads.filter((l) => l.workspaceId === opts.workspaceId);

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i] ?? {};
      const columnCount = Object.keys(raw).length;
      if (columnCount > MAX_COLUMNS) {
        rejected++;
        rowResults.push({
          rowIndex: i,
          outcome: 'rejected',
          reason: `Too many columns (${columnCount}; max ${MAX_COLUMNS})`,
        });
        continue;
      }

      const { canonical, customFields } = mapRowAliases(raw as Record<string, unknown>);
      const fields = buildLeadFieldsFromCanonical(canonical, customFields, opts);
      if (!fields.name || fields.name === 'Unknown') {
        if (!fields.email && !fields.phone && !fields.company && !fields.website) {
          rejected++;
          rowResults.push({ rowIndex: i, outcome: 'rejected', reason: 'Missing identity fields' });
          continue;
        }
      }

      const dupId = findDuplicateLeadId(
        workspaceLeads,
        {
          email: fields.email,
          phone: fields.phone,
          companyNumber: fields.companyNumber,
          website: fields.website,
          company: fields.company,
          townCity: fields.townCity,
        },
      );

      if (dupId) {
        const idx = store.leads.findIndex((l) => l.id === dupId && l.workspaceId === opts.workspaceId);
        if (idx < 0) {
          rejected++;
          rowResults.push({ rowIndex: i, outcome: 'rejected', reason: 'Duplicate primary missing' });
          continue;
        }
        const before = store.leads[idx]!;
        let merged = mergeLeadFields(before, fields, overwrite);
        const changed = JSON.stringify(before) !== JSON.stringify(merged);
        if (changed) {
          merged = appendTimeline(merged, {
            kind: 'merge',
            message: `Merged inbound row ${i + 1} (${overwrite ? 'overwrite' : 'fill empty'})`,
            meta: { jobId, sourceType: String(fields.sourceType ?? '') },
          });
          store.leads[idx] = merged;
          updated++;
          rowResults.push({ rowIndex: i, outcome: 'updated', leadId: merged.id });
          leadsOut.push(merged);
          const wIdx = workspaceLeads.findIndex((l) => l.id === merged.id);
          if (wIdx >= 0) workspaceLeads[wIdx] = merged;
        } else {
          duplicate++;
          rowResults.push({
            rowIndex: i,
            outcome: 'duplicate',
            leadId: before.id,
            reason: 'Exact duplicate; no field changes',
          });
          leadsOut.push(before);
        }
        continue;
      }

      let lead: OutreachLead = {
        id: crypto.randomUUID(),
        workspaceId: opts.workspaceId,
        name: fields.name,
        contactName: fields.contactName || fields.name,
        email: fields.email,
        phone: fields.phone,
        company: fields.company,
        companyNumber: fields.companyNumber,
        website: fields.website,
        niche: fields.niche,
        townCity: fields.townCity,
        googleReviews: fields.googleReviews,
        googleRating: fields.googleRating,
        googleMapsUrl: fields.googleMapsUrl,
        websiteScore: fields.websiteScore,
        ranksTop3: fields.ranksTop3,
        weakness: fields.weakness,
        priority: fields.priority,
        notes: fields.notes,
        dateAdded: fields.dateAdded || stamp,
        source: fields.source ?? 'upload',
        sourceType: fields.sourceType,
        sourceName: fields.sourceName,
        sourceUrl: fields.sourceUrl,
        sourceCapturedAt: fields.sourceCapturedAt || stamp,
        sourceJobId: fields.sourceJobId || jobId,
        ownerWorkerId: fields.ownerWorkerId,
        campaignId: fields.campaignId,
        campaignIds: fields.campaignIds,
        listIds: fields.listIds ?? [],
        pipelineStage: fields.pipelineStage || 'new',
        status: fields.status ?? 'new',
        consentStatus: fields.consentStatus ?? 'unknown',
        customFields: fields.customFields,
        owner: fields.ownerWorkerId,
        tags: fields.niche ? [fields.niche] : [],
        replyState: 'none',
        bookingState: 'none',
        linkedLeadIds: [],
        createdAt: stamp,
        updatedAt: stamp,
        timeline: [],
      };
      lead = appendTimeline(lead, {
    kind: opts.kind === 'import' || opts.kind === 'scrape' || opts.kind === 'sheet_sync' || opts.kind === 'channel'
      ? 'import'
      : 'system',
        message: `Lead ingested from ${lead.sourceType || lead.source}`,
        toStatus: lead.status,
        meta: { jobId },
      });
      store.leads.push(lead);
      workspaceLeads.push(lead);
      created++;
      rowResults.push({ rowIndex: i, outcome: 'created', leadId: lead.id });
      leadsOut.push(lead);

      if (Object.keys(customFields).length > 0) {
        warning++;
        rowResults.push({
          rowIndex: i,
          outcome: 'warning',
          leadId: lead.id,
          reason: `Preserved ${Object.keys(customFields).length} unknown column(s) in customFields`,
        });
      }
    }

    if (opts.persistJob !== false) {
      const job: LeadIngestJob = {
        id: jobId,
        workspaceId: opts.workspaceId,
        kind: opts.kind ?? 'import',
        status: 'completed',
        sourceType: opts.sourceType ?? 'upload',
        sourceName: opts.sourceName,
        sourceUrl: opts.sourceUrl,
        createdAt: stamp,
        updatedAt: nowIso(),
        completedAt: nowIso(),
        created,
        updated,
        duplicate,
        rejected,
        warning,
        rowResults: rowResults.slice(0, 500),
      };
      store.ingestJobs = [job, ...(store.ingestJobs ?? [])].slice(0, 200);
    }
  });

  void refreshFollowUpPlans(opts.workspaceId);
  for (const lead of leadsOut.slice(0, 20)) {
    void syncLeadBoardState(opts.workspaceId, lead.id, 'Lead ingested').catch(() => undefined);
  }

  return {
    created,
    updated,
    duplicate,
    rejected,
    warning,
    leads: leadsOut,
    rowResults,
    jobId,
  };
}

export function listIngestJobs(workspaceId: string, limit = 50): LeadIngestJob[] {
  return loadOutreachStore()
    .ingestJobs
    .filter((j) => j.workspaceId === workspaceId)
    .slice(0, Math.min(200, Math.max(1, limit)));
}

export function getIngestJob(workspaceId: string, jobId: string): LeadIngestJob | null {
  return loadOutreachStore()
    .ingestJobs
    .find((j) => j.workspaceId === workspaceId && j.id === jobId) ?? null;
}

/** Normalize an existing lead for API responses (fill contactName/dateAdded defaults). */
export function hydrateLeadCompat(lead: OutreachLead): OutreachLead {
  return {
    ...lead,
    contactName: lead.contactName || lead.name,
    dateAdded: lead.dateAdded || lead.createdAt,
    sourceType: lead.sourceType || lead.source,
    listIds: lead.listIds ?? [],
    campaignIds: lead.campaignIds ?? (lead.campaignId ? [lead.campaignId] : []),
    consentStatus: lead.consentStatus ?? 'unknown',
    customFields: lead.customFields ?? {},
  };
}

export { normalizeCompanyLocationKey, normalizeWebsite };
