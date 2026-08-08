import type { Tool } from '../types/index.js';
import { resolveOutreachWorkspaceId as resolveWorkspaceId } from './outreach-workspace.js';
import {
  buildDiscoveryLeadSheetColumns,
  buildDiscoveryLeadSheetHeader,
  buildDiscoverySheetAppendRows,
  buildOutreachDiscoveryPilotPlan,
  ingestDiscoveryLeadRows,
  normalizeDiscoveryLeadRow,
} from '../outreach/discovery-funnel.js';
import type { LeadSource } from '../outreach/types.js';

export function createOutreachDiscoveryTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-discovery-plan',
      description:
        'Build the outreach discovery setup plan with required grants, setup order, and safety notes.',
      parameters: {
        type: 'object',
        properties: {
          ownerEmail: { type: 'string' },
          sendFromEmail: { type: 'string' },
          workspaceId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const plan = buildOutreachDiscoveryPilotPlan({
          workspaceId: resolveWorkspaceId(sessionId, params.workspaceId),
          ownerEmail: typeof params.ownerEmail === 'string' ? params.ownerEmail : undefined,
          sendFromEmail: typeof params.sendFromEmail === 'string' ? params.sendFromEmail : undefined,
        });
        return { ok: true, data: plan };
      },
    },
    {
      name: 'outreach-discovery-sheet-schema',
      description: 'Return the canonical outreach lead sheet header and schema.',
      parameters: { type: 'object', properties: {} },
      execute: async () => ({
        ok: true,
        data: {
          header: buildDiscoveryLeadSheetHeader(),
          columns: buildDiscoveryLeadSheetColumns(),
        },
      }),
    },
    {
      name: 'outreach-discovery-normalize-leads',
      description:
        'Normalize a batch of discovery leads into canonical sheet rows and append-ready values.',
      parameters: {
        type: 'object',
        properties: {
          rows: { type: 'array', description: 'Raw lead rows' },
        },
        required: ['rows'],
      },
      execute: async (params) => {
        const rows = Array.isArray(params.rows) ? params.rows : [];
        const normalized = rows
          .map((row) => normalizeDiscoveryLeadRow({
            ...(row as Record<string, unknown>),
            name: String((row as Record<string, unknown>).name ?? (row as Record<string, unknown>).contactName ?? (row as Record<string, unknown>).businessName ?? ''),
          } as any))
          .filter((row): row is Record<string, string> => Boolean(row));
        return {
          ok: true,
          data: {
            header: buildDiscoveryLeadSheetHeader(),
            rows: normalized,
            values: buildDiscoverySheetAppendRows(normalized),
          },
        };
      },
    },
    {
      name: 'outreach-discovery-ingest-leads',
      description:
        'Ingest a batch of discovery leads into the local outreach store with dedupe and source summary.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          rows: { type: 'array', description: 'Lead rows' },
        },
        required: ['rows'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) {
          return { ok: false, error: 'workspaceId required' };
        }
        const rows = Array.isArray(params.rows) ? params.rows : [];
        const result = ingestDiscoveryLeadRows(
          workspaceId,
          rows.map((row) => {
            const raw = row as Record<string, unknown>;
            return {
              name: String(raw.name ?? raw.contactName ?? raw.businessName ?? '').trim(),
              email: typeof raw.email === 'string' ? raw.email.trim() : undefined,
              phone: typeof raw.phone === 'string' ? raw.phone.trim() : undefined,
              company: typeof raw.company === 'string' ? raw.company.trim() : undefined,
              source: typeof raw.source === 'string' ? (raw.source.trim() as LeadSource) : undefined,
              campaignId: typeof raw.campaignId === 'string' ? raw.campaignId.trim() : undefined,
              tags: Array.isArray(raw.tags) ? raw.tags.map((tag) => String(tag).trim()).filter(Boolean) : undefined,
              notes: typeof raw.notes === 'string' ? raw.notes.trim() : undefined,
            };
          }),
        );
        return { ok: true, data: result };
      },
    },
  ];
}
