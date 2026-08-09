import type { Tool } from '../types/index.js';
import { ensureOutreachStoreReady } from '../outreach/store.js';

/**
 * HTTP outreach routes call ensureOutreachStoreReady() per request.
 * Agent tools historically called sync listLeads/loadOutreachStore and raced
 * boot (or a failed first hydrate), surfacing "PostgreSQL cache is not ready"
 * even when the web CRM already had leads.
 */
export function withOutreachStoreReady(tool: Tool): Tool {
  const execute = tool.execute;
  return {
    ...tool,
    execute: async (params) => {
      try {
        await ensureOutreachStoreReady();
      } catch (err) {
        return {
          ok: false,
          error:
            err instanceof Error
              ? `Outreach store unavailable: ${err.message}`
              : 'Outreach store unavailable',
        };
      }
      return execute(params);
    },
  };
}

export function wrapOutreachTools(tools: Tool[]): Tool[] {
  return tools.map(withOutreachStoreReady);
}
