import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildDiscoveryLeadSheetHeader,
  ingestDiscoveryLeadRows,
} from './discovery-funnel.js';
import { listLeads } from './leads.js';
import { outreachStoreDir, loadOutreachStore, mutateOutreachStore } from './store.js';
import type { LeadSheetConfig, LeadSource, OutreachLead, PipelineStatus } from './types.js';

export type { LeadSheetConfig };

function nowIso(): string {
  return new Date().toISOString();
}

function sheetsDir(workspaceId: string): string {
  return path.join(outreachStoreDir(), 'lead-sheets', workspaceId);
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function leadSheetCanonicalHeader(): string[] {
  const header = buildDiscoveryLeadSheetHeader();
  if (!header.includes('campaign_id')) header.push('campaign_id');
  return header;
}

export function leadToSheetRow(lead: OutreachLead): string[] {
  const header = leadSheetCanonicalHeader();
  const map: Record<string, string> = {
    lead_id: lead.id,
    business_name: lead.company || lead.name,
    contact_name: lead.contactName || lead.name,
    email: lead.email || '',
    website: lead.website || '',
    source: lead.sourceType || lead.source,
    niche: lead.niche || lead.tags?.[0] || '',
    location: lead.townCity || '',
    status: lead.status,
    last_touch_at: lead.lastContactedAt || lead.updatedAt || '',
    notes: lead.notes || '',
    company_number: lead.companyNumber || '',
    company_status: '',
    sic_codes: '',
    registered_office: '',
    officer_names: '',
    campaign_id: lead.campaignId || '',
    phone: lead.phone || '',
    google_reviews: lead.googleReviews != null ? String(lead.googleReviews) : '',
    google_rating: lead.googleRating != null ? String(lead.googleRating) : '',
    google_maps_url: lead.googleMapsUrl || '',
    website_score: lead.websiteScore != null ? String(lead.websiteScore) : '',
    ranks_top3: lead.ranksTop3 == null ? '' : String(lead.ranksTop3),
    weakness: lead.weakness || '',
    priority: lead.priority || '',
    date_added: lead.dateAdded || lead.createdAt || '',
    source_url: lead.sourceUrl || '',
  };
  return header.map((col) => map[col] ?? '');
}

/** Workbook-shaped export matching the SEO lead tracker columns plus provenance. */
export function exportCrmWorkbookCsv(
  workspaceId: string,
  filter?: {
    status?: PipelineStatus;
    source?: LeadSource;
    campaignId?: string;
    q?: string;
    niche?: string;
    priority?: string;
    hasEmail?: boolean;
    leadIds?: string[];
  },
): { csv: string; count: number; header: string[] } {
  const header = [
    'Company',
    'Niche',
    'Town/City',
    'Website',
    'Contact Name',
    'Email',
    'Phone',
    'Google Reviews',
    'Google Rating',
    'Google Maps URL',
    'Website Score',
    'Ranks Top3?',
    'Weakness',
    'Priority',
    'Status',
    'Date Added',
    'Notes',
    'Source',
    'Source URL',
    'Pipeline Stage',
    'Last Contact',
    'Last Reply',
    'Next Action',
    'Owner Worker',
  ];
  let leads = listLeads(workspaceId, {
    status: filter?.status,
    source: filter?.source,
    campaignId: filter?.campaignId,
    q: filter?.q,
    niche: filter?.niche,
    priority: filter?.priority,
    hasEmail: filter?.hasEmail,
  });
  if (filter?.leadIds?.length) {
    const allow = new Set(filter.leadIds);
    leads = leads.filter((l) => allow.has(l.id));
  }
  leads = leads.filter((l) => !l.archivedAt);
  const lines = [
    header.join(','),
    ...leads.map((lead) => [
      lead.company || '',
      lead.niche || '',
      lead.townCity || '',
      lead.website || '',
      lead.contactName || lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.googleReviews ?? '',
      lead.googleRating ?? '',
      lead.googleMapsUrl || '',
      lead.websiteScore ?? '',
      lead.ranksTop3 == null ? '' : String(lead.ranksTop3),
      lead.weakness || '',
      lead.priority || '',
      lead.status,
      lead.dateAdded || lead.createdAt || '',
      lead.notes || '',
      lead.sourceType || lead.source || '',
      lead.sourceUrl || '',
      lead.pipelineStage || lead.status || '',
      lead.lastContactedAt || '',
      lead.lastReplyAt || '',
      lead.nextActionAt || '',
      lead.ownerWorkerId || lead.owner || '',
    ].map((v) => csvEscape(String(v))).join(',')),
  ];
  return { csv: lines.join('\n'), count: leads.length, header };
}

export function exportLeadsCsvText(workspaceId: string, filter?: {
  status?: PipelineStatus;
  source?: LeadSource;
  campaignId?: string;
}): { csv: string; count: number; header: string[] } {
  let leads = listLeads(workspaceId, {
    status: filter?.status,
    source: filter?.source,
    campaignId: filter?.campaignId,
  });
  const header = leadSheetCanonicalHeader();
  const lines = [
    header.join(','),
    ...leads.map((lead) => leadToSheetRow(lead).map(csvEscape).join(',')),
  ];
  return { csv: lines.join('\n'), count: leads.length, header };
}

export function listLeadSheetConfigs(workspaceId: string): LeadSheetConfig[] {
  const store = loadOutreachStore();
  const map = store.leadSheetConfigs ?? {};
  return Object.values(map).filter((row) => row.workspaceId === workspaceId);
}

export function getLeadSheetConfig(workspaceId: string, sheetId: string): LeadSheetConfig | null {
  return listLeadSheetConfigs(workspaceId).find((row) => row.id === sheetId) ?? null;
}

export function createWorkspaceLeadSheet(input: {
  workspaceId: string;
  name?: string;
  seedFromLeads?: boolean;
}): LeadSheetConfig {
  const stamp = nowIso();
  const id = crypto.randomUUID();
  const name = (input.name?.trim() || 'CRM leads').slice(0, 120);
  const relativePath = path.join('lead-sheets', input.workspaceId, `${id}.csv`);
  const abs = path.join(outreachStoreDir(), relativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const header = leadSheetCanonicalHeader();
  const lines = [header.join(',')];
  if (input.seedFromLeads) {
    for (const lead of listLeads(input.workspaceId)) {
      lines.push(leadToSheetRow(lead).map(csvEscape).join(','));
    }
  }
  fs.writeFileSync(abs, `${lines.join('\n')}\n`, 'utf8');

  const config: LeadSheetConfig = {
    id,
    workspaceId: input.workspaceId,
    name,
    kind: 'workspace_csv',
    relativePath,
    lastSyncAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    store.leadSheetConfigs[`${input.workspaceId}:${id}`] = config;
  });
  return config;
}

export function updateLeadSheetConfig(
  workspaceId: string,
  sheetId: string,
  patch: Partial<{
    name: string;
    googleSpreadsheetId: string;
    googleSheetUrl: string | null;
  }>,
): LeadSheetConfig | null {
  const existing = getLeadSheetConfig(workspaceId, sheetId);
  if (!existing) return null;
  const next: LeadSheetConfig = {
    ...existing,
    name: patch.name !== undefined ? (patch.name.trim() || existing.name).slice(0, 120) : existing.name,
    googleSpreadsheetId: patch.googleSpreadsheetId !== undefined
      ? (patch.googleSpreadsheetId.trim() || undefined)
      : existing.googleSpreadsheetId,
    googleSheetUrl: patch.googleSheetUrl !== undefined
      ? (patch.googleSheetUrl?.trim() || undefined)
      : existing.googleSheetUrl,
    updatedAt: nowIso(),
  };
  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    store.leadSheetConfigs[`${workspaceId}:${sheetId}`] = next;
  });
  return next;
}

/** Unlink a lead sheet handle. Deletes workspace CSV file when present. Does not delete CRM leads. */
export function deleteLeadSheet(
  workspaceId: string,
  sheetId: string,
): { ok: true; deleted: string; removedFile: boolean } | { ok: false; error: string } {
  const existing = getLeadSheetConfig(workspaceId, sheetId);
  if (!existing) return { ok: false, error: 'Lead sheet not found' };

  let removedFile = false;
  if (existing.kind === 'workspace_csv' && existing.relativePath) {
    const abs = path.join(outreachStoreDir(), existing.relativePath);
    try {
      if (fs.existsSync(abs)) {
        fs.unlinkSync(abs);
        removedFile = true;
      }
    } catch {
      // Still unlink config even if file delete fails
    }
  }

  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    delete store.leadSheetConfigs[`${workspaceId}:${sheetId}`];
  });
  return { ok: true, deleted: sheetId, removedFile };
}

export function linkGoogleLeadSheet(input: {
  workspaceId: string;
  name?: string;
  googleSpreadsheetId: string;
  googleSheetUrl?: string;
}): LeadSheetConfig {
  const stamp = nowIso();
  const id = crypto.randomUUID();
  const config: LeadSheetConfig = {
    id,
    workspaceId: input.workspaceId,
    name: (input.name?.trim() || 'Google leads sheet').slice(0, 120),
    kind: 'google_sheet',
    googleSpreadsheetId: input.googleSpreadsheetId.trim(),
    googleSheetUrl: input.googleSheetUrl?.trim() || undefined,
    createdAt: stamp,
    updatedAt: stamp,
  };
  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    store.leadSheetConfigs[`${input.workspaceId}:${id}`] = config;
  });
  return config;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function readWorkspaceLeadSheetRows(
  workspaceId: string,
  sheetId: string,
  opts?: { offset?: number; limit?: number },
): { ok: true; header: string[]; rows: Record<string, string>[]; total: number } | { ok: false; error: string } {
  const config = getLeadSheetConfig(workspaceId, sheetId);
  if (!config) return { ok: false, error: 'Lead sheet not found' };
  if (config.kind !== 'workspace_csv' || !config.relativePath) {
    return { ok: false, error: 'Only workspace CSV sheets support local row reads; use Google Sheets tools for Google ids' };
  }
  const abs = path.join(outreachStoreDir(), config.relativePath);
  if (!fs.existsSync(abs)) return { ok: false, error: 'Sheet file missing on disk' };
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { ok: true, header: leadSheetCanonicalHeader(), rows: [], total: 0 };
  const header = parseCsvLine(lines[0]!);
  const dataLines = lines.slice(1);
  const offset = Math.max(0, opts?.offset ?? 0);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  const rows = dataLines.slice(offset, offset + limit).map((line) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, idx) => {
      row[key] = cells[idx] ?? '';
    });
    return row;
  });
  return { ok: true, header, rows, total: dataLines.length };
}

export function syncWorkspaceLeadSheetToCrm(
  workspaceId: string,
  sheetId: string,
): { ok: true; created: number; duplicates: number; skipped: number; config: LeadSheetConfig } | { ok: false; error: string } {
  const read = readWorkspaceLeadSheetRows(workspaceId, sheetId, { offset: 0, limit: 5000 });
  if (!read.ok) return read;
  const importRows = read.rows.map((row) => ({
    name: row.contact_name || row.business_name || 'Unknown',
    email: row.email || undefined,
    company: row.business_name || undefined,
    source: (row.source || 'csv_import') as LeadSource,
    notes: row.notes || undefined,
    campaignId: row.campaign_id || undefined,
    tags: row.niche ? [row.niche] : undefined,
    companyNumber: row.company_number || undefined,
  }));
  const result = ingestDiscoveryLeadRows(workspaceId, importRows);
  const stamp = nowIso();
  let updated: LeadSheetConfig | null = null;
  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    const key = `${workspaceId}:${sheetId}`;
    const current = store.leadSheetConfigs[key];
    if (!current) return;
    updated = { ...current, lastSyncAt: stamp, updatedAt: stamp };
    store.leadSheetConfigs[key] = updated;
  });
  if (!updated) return { ok: false, error: 'Lead sheet not found' };
  return {
    ok: true,
    created: result.created.length,
    duplicates: result.duplicates.length,
    skipped: result.skipped,
    config: updated,
  };
}

export function pushCrmLeadsToWorkspaceSheet(
  workspaceId: string,
  sheetId: string,
): { ok: true; count: number; config: LeadSheetConfig } | { ok: false; error: string } {
  const config = getLeadSheetConfig(workspaceId, sheetId);
  if (!config) return { ok: false, error: 'Lead sheet not found' };
  if (config.kind !== 'workspace_csv' || !config.relativePath) {
    return { ok: false, error: 'Push currently supports workspace CSV sheets only' };
  }
  const abs = path.join(outreachStoreDir(), config.relativePath);
  const { csv, count } = exportLeadsCsvText(workspaceId);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, `${csv}\n`, 'utf8');
  const stamp = nowIso();
  let updated: LeadSheetConfig = { ...config, lastSyncAt: stamp, updatedAt: stamp };
  mutateOutreachStore((store) => {
    store.leadSheetConfigs = store.leadSheetConfigs ?? {};
    store.leadSheetConfigs[`${workspaceId}:${sheetId}`] = updated;
  });
  return { ok: true, count, config: updated };
}

export function ensureSheetsDirExists(workspaceId: string): void {
  fs.mkdirSync(sheetsDir(workspaceId), { recursive: true });
}
