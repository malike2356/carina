import type { Tool } from '../types/index.js';
import { convertSpreadsheet } from '../aiva/spreadsheet-engine.js';
import { resolveOutreachWorkspaceId } from './outreach-workspace.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';

export function createAivaSpreadsheetTools(sessionId: string): Tool[] {
  return [{
    name: 'aiva-spreadsheet-convert',
    description:
      'Convert a CSV, TSV, XLS, XLSX, or ODS attachment into tenant-scoped canonical CSV and Excel. '
      + 'Use preview rows to follow the user instruction, including CRM import through outreach-leads-import. '
      + 'Also accepts rows already read from a connected Google Sheet.',
    parameters: {
      type: 'object',
      properties: {
        workspaceId: { type: 'string' },
        sourcePath: { type: 'string', description: 'Local attachment path supplied in the inbound message' },
        sourceName: { type: 'string' },
        rows: { type: 'array', description: 'Rows read from a connected Google Sheet' },
        sheetName: { type: 'string' },
      },
    },
    execute: async (params) => {
      const workspaceId = resolveOutreachWorkspaceId(sessionId, params.workspaceId);
      if (!workspaceId) return { ok: false, error: 'workspaceId required' };
      const workerId = getWorkerSessionContext(sessionId)?.worker.id;
      const job = await convertSpreadsheet({
        workspaceId,
        sourcePath: typeof params.sourcePath === 'string' ? params.sourcePath : undefined,
        sourceName: typeof params.sourceName === 'string' ? params.sourceName : undefined,
        rows: Array.isArray(params.rows) ? params.rows as Array<Record<string, unknown>> : undefined,
        sheetName: typeof params.sheetName === 'string' ? params.sheetName : undefined,
      });
      return {
        ok: true,
        id: job.jobId,
        data: {
          ...job,
          downloadExcel: workerId
            ? `/api/aiva/workers/${workerId}/spreadsheets/${job.jobId}/download?format=xlsx`
            : undefined,
          downloadCsv: workerId
            ? `/api/aiva/workers/${workerId}/spreadsheets/${job.jobId}/download?format=csv`
            : undefined,
          next: 'Follow the user instruction using preview rows. Use outreach-leads-import for CRM lead imports.',
        },
      };
    },
  }];
}
