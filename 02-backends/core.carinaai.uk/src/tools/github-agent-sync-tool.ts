import type { Tool } from '../types/index.js';
import {
  getStatus,
  pullNow,
  pushApprovedDurableUpdates,
  searchSharedKnowledge,
  writeDurableNote,
} from '../sync/github-bridge/index.js';
import type { GithubBridgeScopeKind } from '../sync/github-bridge/types.js';

export const githubAgentSyncTool: Tool = {
  name: 'github-agent-sync',
  description:
    'Scoped durable knowledge bridge over the agent-sync GitHub repo. Actions: status, pull, push, search, note. Never store secrets. Working memory and chat transcripts are rejected.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['status', 'pull', 'push', 'search', 'note'],
      },
      scopeKind: {
        type: 'string',
        enum: ['workspace', 'user', 'shared'],
        description: 'Optional storage scope for this GitHub bridge connection',
      },
      scopeId: {
        type: 'string',
        description: 'Optional explicit scope id for shared or custom calls',
      },
      query: { type: 'string', description: 'Search query (search)' },
      limit: { type: 'number' },
      path: {
        type: 'string',
        description: 'Repo-relative path for durable note (note), e.g. memory/agents/carina/memory.md',
      },
      content: { type: 'string', description: 'Durable markdown content (note)' },
      message: { type: 'string', description: 'Commit message (push)' },
      push: { type: 'boolean', description: 'Push after writing a note (default true)' },
      product: { type: 'string', description: 'Optional product filter for search' },
      agent: { type: 'string', description: 'Optional agent filter for search' },
    },
    required: ['action'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const scope = {
      scopeKind:
        params.scopeKind === 'workspace' || params.scopeKind === 'user' || params.scopeKind === 'shared'
          ? (params.scopeKind as GithubBridgeScopeKind)
          : undefined,
      scopeId: params.scopeId ? String(params.scopeId) : undefined,
    };
    if (action === 'status') return getStatus(scope);
    if (action === 'pull') return pullNow(scope);
    if (action === 'push') {
      return pushApprovedDurableUpdates({
        message: params.message ? String(params.message) : undefined,
      }, scope);
    }
    if (action === 'search') {
      const query = String(params.query ?? '').trim();
      if (!query) return { error: 'query is required' };
      const hits = await searchSharedKnowledge(query, Number(params.limit) || 8, {
        product: params.product ? String(params.product) : undefined,
        agent: params.agent ? String(params.agent) : undefined,
      }, scope);
      return { hits };
    }
    if (action === 'note') {
      const relativePath = String(params.path ?? '').trim();
      const content = String(params.content ?? '');
      if (!relativePath || !content.trim()) return { error: 'path and content are required' };
      return writeDurableNote({
        relativePath,
        content,
        push: params.push !== false,
      }, scope);
    }
    return { error: `unknown action: ${action}` };
  },
};
