import type { Tool } from '../types/index.js';
import {
  appendSharedMemory,
  importInboundMedia,
  importWorkspaceFiles,
  loadCrossAgentContext,
  readAgentSync,
  updateAgentSync,
} from '../sync/agent-sync.js';

export const agentSyncTool: Tool = {
  name: 'agent-sync',
  description:
    'Local workspace memory sync across Carina profiles. Actions: read, append, update, import-workspace, import-media, context. For the shared GitHub durable knowledge bridge use github-agent-sync (status/pull/push/search/note).',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'append', 'update', 'import-workspace', 'import-media', 'context'],
      },
      agent: { type: 'string', description: 'Profile or session name (default: carina)' },
      section: { type: 'string' },
      content: { type: 'string' },
      summary: { type: 'string' },
      facts: { type: 'array', items: { type: 'string' } },
      source_dir: { type: 'string', description: 'Directory to import workspace files or media from' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');

    if (action === 'read') return readAgentSync();
    if (action === 'context') {
      const parts = await loadCrossAgentContext();
      return { context: parts.join('\n\n---\n\n') };
    }
    if (action === 'import-workspace') {
      const dir = params.source_dir ? String(params.source_dir) : undefined;
      return importWorkspaceFiles(dir);
    }
    if (action === 'import-media') {
      const dir = params.source_dir ? String(params.source_dir) : undefined;
      return importInboundMedia(dir);
    }

    if (action === 'append') {
      const section = String(params.section ?? params.agent ?? 'carina');
      const content = String(params.content ?? '').trim();
      if (!content) return { error: 'content is required' };
      await appendSharedMemory(section, content);
      return { appended: true, section };
    }

    if (action === 'update') {
      const agent = String(params.agent ?? 'carina');
      const data = await updateAgentSync(agent, {
        summary: params.summary ? String(params.summary) : undefined,
        facts: Array.isArray(params.facts) ? params.facts.map(String) : undefined,
      });
      return data;
    }

    return { error: `unknown action: ${action}` };
  },
};
