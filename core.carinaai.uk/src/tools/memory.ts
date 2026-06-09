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
    'Save durable information across sessions. Actions: add, replace, remove. Targets: user (profile, 1375 chars max), memory (agent notes, 2200 chars max). Injected into every future turn.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['add', 'replace', 'remove'] },
      target: { type: 'string', enum: ['user', 'memory'], description: 'user = profile, memory = agent notes' },
      content: { type: 'string', description: 'Content to add or replacement text' },
      old_text: { type: 'string', description: 'Text to find for replace/remove' },
    },
    required: ['action', 'target'],
  },
  execute: async (params) => {
    const action = String(params.action ?? '');
    const target = parseTarget(params.target);

    if (action === 'add') {
      const content = String(params.content ?? '');
      const fact = await addPersistentFact(target, content);
      const total = (await listPersistentFacts(target))
        .reduce((sum, f) => sum + f.content.length, 0);
      return {
        status: 'added',
        id: fact.id,
        target,
        budget: { used: total, max: MEMORY_BUDGETS[target] },
      };
    }

    if (action === 'replace') {
      const oldText = String(params.old_text ?? '');
      const newText = String(params.content ?? '');
      const fact = await replacePersistentFact(target, oldText, newText);
      return { status: 'replaced', id: fact.id, target };
    }

    if (action === 'remove') {
      const oldText = String(params.old_text ?? '');
      await removePersistentFact(target, oldText);
      return { status: 'removed', target };
    }

    return { error: `Unknown action: ${action}` };
  },
};
