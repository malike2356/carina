import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import {
  createWorkspaceLeadSheet,
  deleteLeadSheet,
  exportLeadsCsvText,
  leadSheetCanonicalHeader,
  linkGoogleLeadSheet,
  listLeadSheetConfigs,
  pushCrmLeadsToWorkspaceSheet,
  readWorkspaceLeadSheetRows,
  syncWorkspaceLeadSheetToCrm,
  updateLeadSheetConfig,
} from '../outreach/lead-sheets.js';

function resolveWorkspaceId(sessionId: string, explicit?: unknown): string {
  const ctx = getWorkerSessionContext(sessionId);
  const workspaceId = typeof explicit === 'string' ? explicit.trim() : '';
  if (workspaceId) return workspaceId;
  if (ctx?.worker.workspaceId) return ctx.worker.workspaceId;
  return '';
}

export function createOutreachLeadSheetTools(sessionId: string): Tool[] {
  return [
    {
      name: 'outreach-leads-sheet-create',
      description:
        'Create a workspace CSV leads spreadsheet (canonical CRM columns). '
        + 'Prefer this when Google Sheets is not connected. Optionally seed rows from existing CRM leads.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          name: { type: 'string' },
          seedFromLeads: { type: 'boolean' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const config = createWorkspaceLeadSheet({
          workspaceId,
          name: typeof params.name === 'string' ? params.name : undefined,
          seedFromLeads: params.seedFromLeads === true,
        });
        return {
          ok: true,
          id: config.id,
          data: {
            sheet: config,
            header: leadSheetCanonicalHeader(),
            note: 'Workspace CSV created under outreach lead-sheets store. Use outreach-leads-sheet-sync to import rows into CRM.',
          },
        };
      },
    },
    {
      name: 'outreach-leads-sheet-link-google',
      description:
        'Link an existing Google Spreadsheet id as the workspace leads file. '
        + 'Does not create the Google file; use google-sheets-create when available, then link.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          googleSpreadsheetId: { type: 'string' },
          name: { type: 'string' },
          googleSheetUrl: { type: 'string' },
        },
        required: ['googleSpreadsheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const googleSpreadsheetId = String(params.googleSpreadsheetId ?? '').trim();
        if (!workspaceId || !googleSpreadsheetId) {
          return { ok: false, error: 'workspaceId and googleSpreadsheetId required' };
        }
        const config = linkGoogleLeadSheet({
          workspaceId,
          googleSpreadsheetId,
          name: typeof params.name === 'string' ? params.name : undefined,
          googleSheetUrl: typeof params.googleSheetUrl === 'string' ? params.googleSheetUrl : undefined,
        });
        return { ok: true, id: config.id, data: { sheet: config } };
      },
    },
    {
      name: 'outreach-leads-sheet-list',
      description: 'List linked CRM lead spreadsheets for this workspace.',
      parameters: {
        type: 'object',
        properties: { workspaceId: { type: 'string' } },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        return { ok: true, data: { sheets: listLeadSheetConfigs(workspaceId) } };
      },
    },
    {
      name: 'outreach-leads-sheet-read',
      description: 'Read rows from a workspace CSV lead sheet (paginated).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sheetId: { type: 'string' },
          offset: { type: 'number' },
          limit: { type: 'number' },
        },
        required: ['sheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sheetId = String(params.sheetId ?? '').trim();
        if (!workspaceId || !sheetId) return { ok: false, error: 'workspaceId and sheetId required' };
        const result = readWorkspaceLeadSheetRows(workspaceId, sheetId, {
          offset: typeof params.offset === 'number' ? params.offset : undefined,
          limit: typeof params.limit === 'number' ? params.limit : undefined,
        });
        if (!result.ok) return result;
        return { ok: true, data: result };
      },
    },
    {
      name: 'outreach-leads-sheet-sync',
      description: 'Sync a workspace CSV lead sheet into CRM leads (dedupe on email).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sheetId: { type: 'string' },
        },
        required: ['sheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sheetId = String(params.sheetId ?? '').trim();
        if (!workspaceId || !sheetId) return { ok: false, error: 'workspaceId and sheetId required' };
        return syncWorkspaceLeadSheetToCrm(workspaceId, sheetId);
      },
    },
    {
      name: 'outreach-leads-sheet-push',
      description: 'Push current CRM leads into a workspace CSV lead sheet (overwrite file).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sheetId: { type: 'string' },
        },
        required: ['sheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sheetId = String(params.sheetId ?? '').trim();
        if (!workspaceId || !sheetId) return { ok: false, error: 'workspaceId and sheetId required' };
        return pushCrmLeadsToWorkspaceSheet(workspaceId, sheetId);
      },
    },
    {
      name: 'outreach-leads-sheet-update',
      description: 'Rename or update metadata on a linked CRM lead spreadsheet handle.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sheetId: { type: 'string' },
          name: { type: 'string' },
          googleSpreadsheetId: { type: 'string' },
          googleSheetUrl: { type: 'string' },
        },
        required: ['sheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sheetId = String(params.sheetId ?? '').trim();
        if (!workspaceId || !sheetId) return { ok: false, error: 'workspaceId and sheetId required' };
        const sheet = updateLeadSheetConfig(workspaceId, sheetId, {
          name: typeof params.name === 'string' ? params.name : undefined,
          googleSpreadsheetId: typeof params.googleSpreadsheetId === 'string' ? params.googleSpreadsheetId : undefined,
          googleSheetUrl: typeof params.googleSheetUrl === 'string' ? params.googleSheetUrl : undefined,
        });
        if (!sheet) return { ok: false, error: 'Lead sheet not found' };
        return { ok: true, id: sheet.id, data: { sheet } };
      },
    },
    {
      name: 'outreach-leads-sheet-delete',
      description:
        'Delete/unlink a CRM lead spreadsheet handle. Removes workspace CSV file when present. '
        + 'Does NOT delete CRM leads in the table.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          sheetId: { type: 'string' },
        },
        required: ['sheetId'],
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        const sheetId = String(params.sheetId ?? '').trim();
        if (!workspaceId || !sheetId) return { ok: false, error: 'workspaceId and sheetId required' };
        return deleteLeadSheet(workspaceId, sheetId);
      },
    },
    {
      name: 'outreach-leads-export',
      description: 'Export CRM leads as canonical CSV text (same schema as lead sheets).',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string' },
          campaignId: { type: 'string' },
        },
      },
      execute: async (params) => {
        const workspaceId = resolveWorkspaceId(sessionId, params.workspaceId);
        if (!workspaceId) return { ok: false, error: 'workspaceId required' };
        const result = exportLeadsCsvText(workspaceId, {
          status: typeof params.status === 'string' ? params.status as never : undefined,
          source: typeof params.source === 'string' ? params.source as never : undefined,
          campaignId: typeof params.campaignId === 'string' ? params.campaignId : undefined,
        });
        return {
          ok: true,
          data: {
            count: result.count,
            header: result.header,
            csv: result.csv,
          },
        };
      },
    },
  ];
}
