import type { Tool } from '../types/index.js';
import {
  addPersistentFact,
  removePersistentFact,
  replacePersistentFact,
  listPersistentFacts,
  MEMORY_BUDGETS,
  type MemoryTarget,
} from '../memory/persistent-memory.js';

function parseTarget(value: unknown): MemoryTarget {
  const t = String(value ?? 'memory').toLowerCase();
  if (t === 'user') return 'user';
  return 'memory';
}

export const memoryTool: Tool = {
  name: 'memory',
  description:
    'Save and retrieve durable long-term information across sessions. MANDATORY: call this tool whenever the user explicitly says "remember", "note that", "keep in mind", or similar. Do not just acknowledge verbally. Actions: add (write a new fact), list (enumerate all saved facts for a target), replace (find-and-replace one fact), remove (delete one fact). Targets: user (user profile and preferences, 1375 chars max), memory (agent working notes, 2200 chars max).',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'list', 'replace', 'remove'] },
      target: { type: 'string', enum: ['user', 'memory'], description: 'user = profile, memory = agent notes' },
      content: { type: 'string', description: 'Content to add or replacement text' },
      old_text: { type: 'string', description: 'Text to find for replace/remove' },
    },
    required: ['action', 'target'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const target = parseTarget(params.target);

    try {
      if (action === 'add') {
        const content = String(params.content ?? '').trim();
        if (!content) return { error: 'content is required for add' };
        const fact = await addPersistentFact(target, content);
        const facts = await listPersistentFacts(target);
        const used = facts.reduce((sum, f) => sum + f.content.length, 0);
        return {
          status: 'added',
          id: fact.id,
          target,
          budget: { used, max: MEMORY_BUDGETS[target] },
        };
      }

      if (action === 'list') {
        const facts = await listPersistentFacts(target);
        const used = facts.reduce((sum, f) => sum + f.content.length, 0);
        return {
          target,
          count: facts.length,
          facts: facts.map((f) => ({ id: f.id, content: f.content, created_at: f.createdAt })),
          budget: { used, max: MEMORY_BUDGETS[target] },
        };
      }

      if (action === 'replace') {
        const oldText = String(params.old_text ?? '').trim();
        const newText = String(params.content ?? '').trim();
        if (!oldText) return { error: 'old_text is required for replace' };
        if (!newText) return { error: 'content is required for replace' };
        const fact = await replacePersistentFact(target, oldText, newText);
        return { status: 'replaced', id: fact.id, target };
      }

      if (action === 'remove') {
        const oldText = String(params.old_text ?? '').trim();
        if (!oldText) return { error: 'old_text is required for remove' };
        await removePersistentFact(target, oldText);
        return { status: 'removed', target };
      }

      return { error: `Unknown action: ${action}` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { error: msg };
    }
  },
};
