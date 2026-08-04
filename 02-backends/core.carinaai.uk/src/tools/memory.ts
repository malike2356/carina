import type { Tool } from '../types/index.js';
import {
  addPersistentFact,
  removePersistentFact,
  replacePersistentFact,
  listPersistentFacts,
  searchPersistentFacts,
  getPersistentFactById,
  activeAgentName,
  MEMORY_BUDGETS,
  type MemoryTarget,
} from '../memory/persistent-memory.js';
import { validateMemoryContent } from '../memory/memory-discipline.js';

function parseTarget(value: unknown): MemoryTarget {
  const t = String(value ?? 'memory').toLowerCase();
  if (t === 'user') return 'user';
  return 'memory';
}

export const memoryTool: Tool = {
  name: 'memory',
  description:
    'Save and retrieve durable long-term information across sessions. MANDATORY: call this tool whenever the user explicitly says "remember", "note that", "keep in mind", or similar. Do not just acknowledge verbally. '
    + 'Save declarative facts (preferences, stable environment conventions, corrections). '
    + 'Do NOT save task progress, PR/issue numbers, commit SHAs, session outcomes, or instructions to yourself. '
    + 'Use session-search for past work history. '
    + 'Actions: add (write a new fact), list (enumerate all saved facts for a target), search (find facts by query), get (fetch one fact by id), replace (find-and-replace one fact), remove (delete one fact). '
    + 'Targets: user (user profile and preferences, 1375 chars max), memory (agent working notes, 2200 chars max).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'list', 'search', 'get', 'replace', 'remove'] },
      target: { type: 'string', enum: ['user', 'memory'], description: 'user = profile, memory = agent notes' },
      content: { type: 'string', description: 'Content to add or replacement text' },
      old_text: { type: 'string', description: 'Text to find for replace/remove' },
      query: { type: 'string', description: 'Search query for action=search' },
      id: { type: 'string', description: 'Fact id for action=get' },
      limit: { type: 'number', description: 'Max results for action=search (default 5)' },
    },
    required: ['action', 'target'],
  },
  execute: async (params) => {
    const callerSessionId =
      typeof params._sessionId === 'string' ? params._sessionId.trim() : '';
    if (callerSessionId.startsWith('aiva-')) {
      return {
        error:
          'Host memory is disabled for Aiva. Use worker-memory (durable facts) '
          + 'or worker-conversation-search (this worker\'s chats only).',
      };
    }

    const action = String(params.action ?? '');
    const target = parseTarget(params.target);
    const agentId = target === 'memory' ? activeAgentName() : undefined;

    try {
      if (action === 'add') {
        const content = String(params.content ?? '').trim();
        if (!content) return { error: 'content is required for add' };
        const validation = validateMemoryContent(content);
        if (!validation.ok) return { error: validation.reason };
        const fact = await addPersistentFact(target, content, { agentId });
        const facts = await listPersistentFacts(target, agentId);
        const used = facts.reduce((sum, f) => sum + f.content.length, 0);
        if (!fact) {
          return {
            status: 'added',
            target,
            budget: { used, max: MEMORY_BUDGETS[target] },
          };
        }
        return {
          status: 'added',
          id: fact.id,
          target,
          budget: { used, max: MEMORY_BUDGETS[target] },
        };
      }

      if (action === 'list') {
        const facts = await listPersistentFacts(target, agentId);
        const used = facts.reduce((sum, f) => sum + f.content.length, 0);
        return {
          target,
          count: facts.length,
          facts: facts.map((f) => ({ id: f.id, content: f.content, created_at: f.createdAt })),
          budget: { used, max: MEMORY_BUDGETS[target] },
        };
      }

      if (action === 'search') {
        const query = String(params.query ?? params.content ?? '').trim();
        if (!query) return { error: 'query is required for search' };
        const limit = Number(params.limit ?? 5);
        const facts = await searchPersistentFacts(query, {
          target,
          limit: Number.isFinite(limit) ? limit : 5,
          agentId,
        });
        return {
          target,
          query,
          count: facts.length,
          facts: facts.map((f) => ({ id: f.id, content: f.content, created_at: f.createdAt })),
        };
      }

      if (action === 'get') {
        const factId = String(params.id ?? '').trim();
        if (!factId) return { error: 'id is required for get' };
        const fact = await getPersistentFactById(factId, agentId);
        if (!fact) return { error: `No fact found with id "${factId}" for target "${target}".` };
        if (fact.target !== target) {
          return { error: `Fact "${factId}" belongs to target "${fact.target}", not "${target}".` };
        }
        return {
          id: fact.id,
          target: fact.target,
          content: fact.content,
          created_at: fact.createdAt,
        };
      }

      if (action === 'replace') {
        const oldText = String(params.old_text ?? '').trim();
        const newText = String(params.content ?? '').trim();
        if (!oldText) return { error: 'old_text is required for replace' };
        if (!newText) return { error: 'content is required for replace' };
        const validation = validateMemoryContent(newText);
        if (!validation.ok) return { error: validation.reason };
        const fact = await replacePersistentFact(target, oldText, newText, agentId);
        if (!fact) {
          return { status: 'replaced', target };
        }
        return { status: 'replaced', id: fact.id, target };
      }

      if (action === 'remove') {
        const oldText = String(params.old_text ?? '').trim();
        if (!oldText) return { error: 'old_text is required for remove' };
        await removePersistentFact(target, oldText, agentId);
        return { status: 'removed', target };
      }

      return { error: `Unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
