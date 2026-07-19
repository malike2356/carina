import type { Tool } from '../types/index.js';
import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { registerSessionTool } from './session-tool-store.js';
import {
  addWorkerPersistentFact,
  listWorkerPersistentFacts,
  removeWorkerPersistentFact,
  replaceWorkerPersistentFact,
  getWorkerMemoryBudgetStatus,
  type WorkerMemoryTarget,
} from '../memory/aiva/worker-persistent-memory.js';
import { searchWorkerConversations } from '../memory/aiva/conversation-search.js';

function parseTarget(value: unknown): WorkerMemoryTarget {
  return value === 'user' ? 'user' : 'memory';
}

export function createWorkerMemoryTools(sessionId: string): Tool[] {
  return [
    {
      name: 'worker-memory',
      description:
        'Manage this Aiva worker\'s bounded durable memory (Hermes-style USER/MEMORY). '
        + 'Use target=user for contact preferences; target=memory for agent operating notes. '
        + 'Hard caps: user 1375 chars, memory 2200 chars. For old chats use session-search.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['add', 'list', 'replace', 'remove', 'budget'],
          },
          target: {
            type: 'string',
            enum: ['user', 'memory'],
            description: 'user = contact profile; memory = agent notes',
          },
          content: { type: 'string' },
          old_text: { type: 'string', description: 'Substring match for replace/remove' },
          contact_id: { type: 'string' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const action = String(params.action ?? '').trim();
        const target = parseTarget(params.target);
        const contactId =
          typeof params.contact_id === 'string' && params.contact_id.trim()
            ? params.contact_id.trim()
            : null;

        if (action === 'list' || action === 'budget') {
          const [user, memory, userBudget, memoryBudget] = await Promise.all([
            listWorkerPersistentFacts({
              workspaceId: ctx.worker.workspaceId,
              workerId: ctx.worker.id,
              target: 'user',
              contactId,
            }),
            listWorkerPersistentFacts({
              workspaceId: ctx.worker.workspaceId,
              workerId: ctx.worker.id,
              target: 'memory',
            }),
            getWorkerMemoryBudgetStatus({
              workspaceId: ctx.worker.workspaceId,
              workerId: ctx.worker.id,
              target: 'user',
              contactId,
            }),
            getWorkerMemoryBudgetStatus({
              workspaceId: ctx.worker.workspaceId,
              workerId: ctx.worker.id,
              target: 'memory',
            }),
          ]);
          return {
            ok: true,
            budgets: { user: userBudget, memory: memoryBudget },
            user: user.map((f) => ({ id: f.id, content: f.content })),
            memory: memory.map((f) => ({ id: f.id, content: f.content })),
          };
        }

        if (action === 'add') {
          const content = String(params.content ?? '').trim();
          if (!content) return { ok: false, error: 'content required' };
          const fact = await addWorkerPersistentFact({
            workspaceId: ctx.worker.workspaceId,
            workerId: ctx.worker.id,
            target,
            content,
            contactId,
            sessionId,
          });
          return { ok: true, fact };
        }

        if (action === 'replace') {
          const oldText = String(params.old_text ?? '').trim();
          const content = String(params.content ?? '').trim();
          if (!oldText || !content) return { ok: false, error: 'old_text and content required' };
          const fact = await replaceWorkerPersistentFact({
            workspaceId: ctx.worker.workspaceId,
            workerId: ctx.worker.id,
            oldText,
            content,
            target,
            contactId,
          });
          return { ok: true, fact };
        }

        if (action === 'remove') {
          const idOrText = String(params.old_text ?? params.content ?? '').trim();
          if (!idOrText) return { ok: false, error: 'old_text or content required' };
          const result = await removeWorkerPersistentFact({
            workspaceId: ctx.worker.workspaceId,
            workerId: ctx.worker.id,
            idOrText,
          });
          return { ok: true, ...result };
        }

        return { ok: false, error: `Unknown action: ${action}` };
      },
    },
    {
      name: 'worker-conversation-search',
      description:
        'Search this worker\'s full conversation store (episodic + employee thread). '
        + 'Use for "did we discuss X" questions; not a replacement for worker-memory.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' },
        },
        required: ['query'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const query = String(params.query ?? '').trim();
        if (!query) return { ok: false, error: 'query required' };
        const hits = await searchWorkerConversations({
          workspaceId: ctx.worker.workspaceId,
          workerId: ctx.worker.id,
          query,
          limit: Number(params.limit ?? 10),
        });
        return { ok: true, count: hits.length, hits };
      },
    },
  ];
}

export function registerWorkerMemorySessionTools(sessionId: string): void {
  for (const tool of createWorkerMemoryTools(sessionId)) {
    registerSessionTool(sessionId, tool);
  }
}
