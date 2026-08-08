import { CHANNEL_REQUIREMENTS, type ChannelRequirement } from '../channels/channel-requirements.js';
import { ALL_CONFIG_DOMAINS } from '../config/settings-requirements.js';
import { createLead, importLeadBatch } from './leads.js';
import type { LeadSource, OutreachLead, PipelineStatus } from './types.js';

export type DiscoveryWorkspaceGrant = {
  id: string;
  label: string;
  reason: string;
  kind: 'integration' | 'channel' | 'automation' | 'document';
  required: boolean;
  setupTarget: string;
  configurationHint?: string;
};

export type DiscoveryPilotPlan = {
  workspaceId?: string;
  ownerEmail?: string;
  sendFromEmail?: string;
  requiredGrants: DiscoveryWorkspaceGrant[];
  optionalGrants: DiscoveryWorkspaceGrant[];
  setupOrder: string[];
  checklist: string[];
  notes: string[];
};

export type DiscoverySheetColumn = {
  key: string;
  label: string;
  required: boolean;
  description: string;
};

export type DiscoveryLeadImportRow = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  companyNumber?: string;
  companyStatus?: string;
  sicCodes?: string | string[];
  registeredOffice?: string;
  officerNames?: string | string[];
  source?: LeadSource;
  campaignId?: string;
  tags?: string[];
  status?: PipelineStatus;
  notes?: string;
};

export type DiscoveryLeadImportResult = {
  created: OutreachLead[];
  duplicates: OutreachLead[];
  skipped: number;
  rows: number;
  sourceSummary: Record<string, number>;
};

function pushUnique(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

function buildGrantFromChannel(requirement: ChannelRequirement): DiscoveryWorkspaceGrant {
  return {
    id: `channel:${requirement.id}`,
    label: requirement.name,
    reason: requirement.description,
    kind: 'channel',
    required: true,
    setupTarget: `Settings -> Channels -> ${requirement.name}`,
    configurationHint: requirement.fields.map((field) => field.label).join(', '),
  };
}

function buildGrantFromIntegration(id: string, label: string, reason: string, required = true): DiscoveryWorkspaceGrant {
  return {
    id,
    label,
    reason,
    kind: 'integration',
    required,
    setupTarget: `Settings -> ${label}`,
  };
}

export function buildOutreachDiscoveryPilotPlan(input: {
  workspaceId?: string;
  ownerEmail?: string;
  sendFromEmail?: string;
} = {}): DiscoveryPilotPlan {
  const requiredGrants: DiscoveryWorkspaceGrant[] = [];
  const optionalGrants: DiscoveryWorkspaceGrant[] = [];

  const googleWorkspace = ALL_CONFIG_DOMAINS.find((domain) => domain.id === 'integration:google-workspace');
  const trello = ALL_CONFIG_DOMAINS.find((domain) => domain.id === 'integration:trello');
  const companiesHouse = ALL_CONFIG_DOMAINS.find((domain) => domain.id === 'integration:companies-house');

  if (googleWorkspace) {
    requiredGrants.push(buildGrantFromIntegration(
      googleWorkspace.id,
      googleWorkspace.name,
      'Provides Gmail, Calendar, Drive, and Contacts access for the outreach pilot.',
    ));
  }
  if (trello) {
    requiredGrants.push(buildGrantFromIntegration(
      trello.id,
      trello.name,
      'Used as the week-one Kanban surface for contacted, replied, booked, and follow-up stages.',
    ));
  }
  if (companiesHouse) {
    optionalGrants.push(buildGrantFromIntegration(
      companiesHouse.id,
      companiesHouse.name,
      'Optional UK lead-source enrichment for companies and officers.',
      false,
    ));
  }

  for (const requirement of CHANNEL_REQUIREMENTS) {
    if (requirement.id !== 'telegram') continue;
    requiredGrants.push(buildGrantFromChannel(requirement));
  }

  requiredGrants.push({
    id: 'automation:worker-automation',
    label: 'worker-automation',
    reason: 'Schedules the daily send window, reply watcher, reminder jobs, and owner prompts.',
    kind: 'automation',
    required: true,
    setupTarget: 'Aiva chat or workspace automation settings',
  });

  const setupOrder = [
    'Connect Google Workspace so Gmail, Calendar, Drive, and Contacts can be used.',
    'Connect Trello so the funnel has a visible board from the start.',
    'Connect Telegram so the owner gets real-time alerts and can control outreach by chat.',
    'Turn on worker-automation for daily cadence, reply polling, and reminder jobs.',
    'Optionally wire Companies House for better UK company discovery and enrichment.',
    'Seed the discovery checklist document and the lead sheet before sending anything.',
  ];

  const checklist = [
    'Confirm the sending mailbox matches the approved business address.',
    'Confirm Calendar free/busy access before offering any meeting slot.',
    'Confirm Sheets append access before importing leads.',
    'Confirm Contacts read/write access for enrichment and dedupe.',
    'Confirm Telegram receives owner alerts before the first send.',
    'Confirm the daily cap and warm-up policy before enabling automation.',
  ];

  const notes = [
    'Never imply that a grant exists if the tool connect is not active.',
    'Keep cold email approval-gated until the workspace policy flips it on.',
    'Keep Google Workspace and Telegram as the pilot minimum; do not require a parallel CRM.',
  ];

  return {
    workspaceId: input.workspaceId,
    ownerEmail: input.ownerEmail?.trim() || undefined,
    sendFromEmail: input.sendFromEmail?.trim() || undefined,
    requiredGrants,
    optionalGrants,
    setupOrder,
    checklist,
    notes,
  };
}

export function buildDiscoveryLeadSheetColumns(): DiscoverySheetColumn[] {
  return [
    { key: 'lead_id', label: 'lead_id', required: true, description: 'Stable unique lead id' },
    { key: 'business_name', label: 'business_name', required: true, description: 'Business or company name' },
    { key: 'contact_name', label: 'contact_name', required: true, description: 'Primary contact name' },
    { key: 'email', label: 'email', required: false, description: 'Primary email address' },
    { key: 'website', label: 'website', required: false, description: 'Website or landing page' },
    { key: 'source', label: 'source', required: true, description: 'manual, scrape, youtube_comment, import, companies_house' },
    { key: 'niche', label: 'niche', required: false, description: 'Target niche or sector' },
    { key: 'location', label: 'location', required: false, description: 'City, region, or country' },
    { key: 'status', label: 'status', required: true, description: 'new, queued, contacted, replied, booked, showed, won, dead, nurture' },
    { key: 'last_touch_at', label: 'last_touch_at', required: false, description: 'Last contact timestamp' },
    { key: 'notes', label: 'notes', required: false, description: 'Free-form notes' },
    { key: 'company_number', label: 'company_number', required: false, description: 'Companies House company number' },
    { key: 'company_status', label: 'company_status', required: false, description: 'Companies House status' },
    { key: 'sic_codes', label: 'sic_codes', required: false, description: 'Comma-separated SIC codes' },
    { key: 'registered_office', label: 'registered_office', required: false, description: 'Registered office address' },
    { key: 'officer_names', label: 'officer_names', required: false, description: 'Comma-separated officer names' },
    { key: 'campaign_id', label: 'campaign_id', required: false, description: 'Optional outreach campaign id' },
  ];
}

export function buildDiscoveryLeadSheetHeader(): string[] {
  return buildDiscoveryLeadSheetColumns().map((column) => column.label);
}

export function normalizeDiscoveryLeadRow(row: DiscoveryLeadImportRow & { businessName?: string; contactName?: string; website?: string; location?: string; leadId?: string; companyNumber?: string; companyStatus?: string; sicCodes?: string | string[]; registeredOffice?: string; officerNames?: string | string[] }): Record<string, string> | null {
  const name = (row.name || row.contactName || '').trim();
  const company = (row.company || row.businessName || '').trim();
  const email = (row.email || '').trim();
  const phone = (row.phone || '').trim();
  const leadId = (row.leadId || '').trim();
  const source = (row.source || 'manual').trim();
  const status = (row.status || 'new').trim();

  if (!name && !company) return null;
  if (!email && !phone && !leadId) return null;

  const sicCodes = Array.isArray(row.sicCodes) ? row.sicCodes.join(', ') : (row.sicCodes || '').trim();
  const officerNames = Array.isArray(row.officerNames) ? row.officerNames.join(', ') : (row.officerNames || '').trim();

  return {
    lead_id: leadId || '',
    business_name: company || name,
    contact_name: name || company,
    email,
    website: (row.website || '').trim(),
    source,
    niche: (row.tags?.[0] || '').trim(),
    location: (row.location || '').trim(),
    status,
    last_touch_at: '',
    notes: (row.notes || '').trim(),
    company_number: (row.companyNumber || '').trim(),
    company_status: (row.companyStatus || '').trim(),
    sic_codes: sicCodes,
    registered_office: (row.registeredOffice || '').trim(),
    officer_names: officerNames,
    campaign_id: (row as { campaignId?: string }).campaignId?.trim?.() || '',
    phone,
  };
}

export function buildDiscoverySheetAppendRows(rows: Array<Record<string, string>>): string[][] {
  const header = buildDiscoveryLeadSheetHeader();
  return rows.map((row) => header.map((column) => row[column] ?? ''));
}

export function ingestDiscoveryLeadRows(
  workspaceId: string,
  rows: DiscoveryLeadImportRow[],
): DiscoveryLeadImportResult {
  const created: OutreachLead[] = [];
  const duplicates: OutreachLead[] = [];
  let skipped = 0;
  const sourceSummary: Record<string, number> = {};
  const normalizedRows: Array<{
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    companyNumber?: string;
    source?: LeadSource;
    campaignId?: string;
    tags?: string[];
    notes?: string;
  }> = [];

  for (const row of rows) {
    const source = row.source ?? 'manual';
    sourceSummary[source] = (sourceSummary[source] ?? 0) + 1;

    const normalized = normalizeDiscoveryLeadRow({
      ...row,
      name: row.name,
    });
    if (!normalized) {
      skipped++;
      continue;
    }
    normalizedRows.push({
      name: normalized.contact_name || normalized.business_name,
      email: normalized.email || undefined,
      phone: row.phone?.trim() || undefined,
      company: normalized.business_name || undefined,
      companyNumber: normalized.company_number || undefined,
      source: source as LeadSource,
      campaignId: row.campaignId,
      tags: row.tags,
      notes: row.notes,
    });
  }

  const batch = importLeadBatch(
    workspaceId,
    normalizedRows.map((row) => ({
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      companyNumber: row.companyNumber,
      source: row.source,
      campaignId: row.campaignId,
      tags: row.tags,
    })),
  );
  created.push(...batch.created);
  duplicates.push(...batch.duplicates);

  return {
    created,
    duplicates,
    skipped,
    rows: rows.length,
    sourceSummary,
  };
}

export function createDiscoveryLead(
  workspaceId: string,
  row: DiscoveryLeadImportRow & { companyNumber?: string },
): { lead: OutreachLead; duplicateOf?: string } {
  return createLead({
    workspaceId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    companyNumber: row.companyNumber,
    source: row.source ?? 'manual',
    campaignId: row.campaignId,
    notes: row.notes,
    tags: row.tags,
  });
}
