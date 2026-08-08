import type { Tool } from '../types/index.js';
import { resolveOutreachWorkspaceId } from './outreach-workspace.js';
import {
  createLead,
  deleteLead,
  getLead,
  importLeadBatch,
  listLeads,
  updateLead,
} from '../outreach/leads.js';
import { isPipelineStatus } from '../outreach/pipeline.js';
import type { LeadSource, PipelineStatus } from '../outreach/types.js';

export function createOutreachLeadCrudTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-leads-list',
      description: 'List CRM outreach leads for this workspace (optional filters).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string' },
          campaignId: { type: 'string' },
          tag: { type: 'string' },
          query: { type: 'string', description: 'Search name/email/company' },
          limit: { type: 'number' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const status = typeof params.status === 'string' && isPipelineStatus(params.status)
          ? params.status
          : undefined;
        let leads = listLeads(workspaceId, {
          status,
          source: typeof params.source === 'string' ? params.source as LeadSource : undefined,
          campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          tag: typeof params.tag === 'string' ? params.tag : undefined,
        });
        const query = typeof params.query === 'string' ? params.query.trim().toLowerCase() : '';
        if (query) {
          leads = leads.filter((lead) =>
            [lead.name, lead.email, lead.company, lead.phone]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(query));
        }
        const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50) || 50));
        return {
          ok: true,
          data: {
            total: leads.length,
            leads: leads.slice(0, limit).map((lead) => ({
              id: lead.id,
              name: lead.name,
              email: lead.email,
              company: lead.company,
              status: lead.status,
              source: lead.source,
              campaignId: lead.campaignId,
              nextActionAt: lead.nextActionAt,
              updatedAt: lead.updatedAt,
            })),
          },
        };
      },
    },
    {
      name: 'outreach-leads-get',
      description: 'Get one CRM lead by id including timeline summary.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadId: { type: 'string' },
        },
        required: ['leadId'],
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        const leadId = String(params.leadId ?? '').trim();
        if (!workspaceId || !leadId) return { ok: false, error: 'workspaceId and leadId required' };
        const lead = getLead(workspaceId, leadId);
        if (!lead) return { ok: false, error: 'Lead not found' };
        return { ok: true, data: { lead } };
      },
    },
    {
      name: 'outreach-leads-create',
      description: 'Create a CRM outreach lead (dedupes on email/phone).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          source: { type: 'string' },
          campaignId: { type: 'string' },
          notes: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['name'],
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        const name = String(params.name ?? '').trim();
        if (!workspaceId || !name) return { ok: false, error: 'workspaceId and name required' };
        const result = createLead({
          workspaceId,
          name,
          email: typeof params.email === 'string' ? params.email : undefined,
          phone: typeof params.phone === 'string' ? params.phone : undefined,
          company: typeof params.company === 'string' ? params.company : undefined,
          source: typeof params.source === 'string' ? params.source as LeadSource : 'manual',
          campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          notes: typeof params.notes === 'string' ? params.notes : undefined,
          tags: Array.isArray(params.tags) ? params.tags.map(String) : undefined,
        });
        return {
          ok: true,
          data: {
            lead: result.lead,
            duplicateOf: result.duplicateOf ?? null,
          },
        };
      },
    },
    {
      name: 'outreach-leads-update',
      description: 'Update a CRM lead (fields and/or pipeline status).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          phone: { type: 'string' },
          company: { type: 'string' },
          status: { type: 'string' },
          notes: { type: 'string' },
          campaignId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['leadId'],
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        const leadId = String(params.leadId ?? '').trim();
        if (!workspaceId || !leadId) return { ok: false, error: 'workspaceId and leadId required' };
        const status = typeof params.status === 'string' && isPipelineStatus(params.status)
          ? params.status as PipelineStatus
          : undefined;
        const lead = updateLead(workspaceId, leadId, {
          name: typeof params.name === 'string' ? params.name : undefined,
          email: typeof params.email === 'string' ? params.email : undefined,
          phone: typeof params.phone === 'string' ? params.phone : undefined,
          company: typeof params.company === 'string' ? params.company : undefined,
          status,
          notes: typeof params.notes === 'string' ? params.notes : undefined,
          campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
          tags: Array.isArray(params.tags) ? params.tags.map(String) : undefined,
        });
        if (!lead) return { ok: false, error: 'Lead not found' };
        return { ok: true, data: { lead } };
      },
    },
    {
      name: 'outreach-leads-delete',
      description: 'Delete a CRM lead from the outreach store.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          leadId: { type: 'string' },
        },
        required: ['leadId'],
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        const leadId = String(params.leadId ?? '').trim();
        if (!workspaceId || !leadId) return { ok: false, error: 'workspaceId and leadId required' };
        const ok = deleteLead(workspaceId, leadId);
        if (!ok) return { ok: false, error: 'Lead not found' };
        return { ok: true, data: { deleted: leadId } };
      },
    },
    {
      name: 'outreach-leads-import',
      description: 'Import a batch of CRM leads (CSV-style rows). Dedupes on email/phone.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          rows: {
            type: 'array',
            description: 'Array of { name, email?, phone?, company?, source?, tags? }',
          },
        },
        required: ['rows'],
      },
      execute: async (params) => {
        const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const rows = Array.isArray(params.rows) ? params.rows : [];
        if (rows.length === 0) return { ok: false, error: 'rows required' };
        const normalized = rows.map((row) => {
          const r = row as Record<string, unknown>;
          return {
            name: String(r.name ?? r.contact_name ?? r.business_name ?? 'Unknown'),
            email: typeof r.email === 'string' ? r.email : undefined,
            phone: typeof r.phone === 'string' ? r.phone : undefined,
            company: typeof r.company === 'string' ? r.company : undefined,
            source: (typeof r.source === 'string' ? r.source : 'csv_import') as LeadSource,
            tags: Array.isArray(r.tags) ? r.tags.map(String) : undefined,
          };
        });
        const result = importLeadBatch(workspaceId, normalized);
        return {
          ok: true,
          data: {
            created: result.created.length,
            duplicates: result.duplicates.length,
            createdIds: result.created.map((l) => l.id),
          },
        };
      },
    },
  ];
}
