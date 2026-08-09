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
import {
  listWorkerSkills,
  runWorkerSkill,
} from '../workers/aiva-parity-store.js';
import { listActivity } from '../workers/worker-store.js';

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
        + 'Hard caps: user 1375 chars, memory 2200 chars. For old chats use worker-conversation-search.',
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
        + 'Scoped to this Aiva only; never searches other workers or host sessions. '
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
    {
      name: 'worker-activity-audit',
      description:
        'Self-inventory of this Aiva\'s logged activities (inbound/outbound messages, escalations, tooled actions). '
        + 'Use for "what did you do", activity audit, inventory of work, or last N hours/days. '
        + 'Scoped to this worker only. Prefer this over host session-search (unavailable on Aiva).',
      parameters: {
        type: 'object',
        properties: {
          hours: {
            type: 'number',
            description: 'Lookback window in hours (default 24, max 168)',
          },
          limit: {
            type: 'number',
            description: 'Max events to return (default 80, max 200)',
          },
          action_type: {
            type: 'string',
            description: 'Optional filter, e.g. message_received, message_sent, summary_sent',
          },
        },
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const hoursRaw = Number(params.hours ?? 24);
        const hours = Number.isFinite(hoursRaw)
          ? Math.min(168, Math.max(1, Math.floor(hoursRaw)))
          : 24;
        const limitRaw = Number(params.limit ?? 80);
        const limit = Number.isFinite(limitRaw)
          ? Math.min(200, Math.max(1, Math.floor(limitRaw)))
          : 80;
        const actionFilter = String(params.action_type ?? '').trim().toLowerCase();
        const sinceMs = Date.now() - hours * 60 * 60 * 1000;

        const rows = await listActivity(ctx.worker.workspaceId, ctx.worker.id, Math.max(limit * 3, 120));
        const filtered = rows
          .filter((row) => row.createdAt.getTime() >= sinceMs)
          .filter((row) => !actionFilter || row.actionType.toLowerCase() === actionFilter)
          .slice(0, limit);

        const byType: Record<string, number> = {};
        const byChannel: Record<string, number> = {};
        for (const row of filtered) {
          byType[row.actionType] = (byType[row.actionType] ?? 0) + 1;
          const channel = row.channel ?? 'unknown';
          byChannel[channel] = (byChannel[channel] ?? 0) + 1;
        }

        return {
          ok: true,
          workerId: ctx.worker.id,
          workerName: ctx.worker.name,
          hours,
          totalInWindow: filtered.length,
          byType,
          byChannel,
          events: filtered.map((row) => ({
            at: row.createdAt.toISOString(),
            actionType: row.actionType,
            channel: row.channel ?? null,
            contactId: row.contactId ?? null,
            summary: row.summary,
            escalated: row.escalated,
            inputPreview: row.inputText ? row.inputText.slice(0, 160) : null,
            outputPreview: row.outputText ? row.outputText.slice(0, 160) : null,
          })),
        };
      },
    },
    {
      name: 'worker-skills',
      description:
        'List or run this Aiva\'s saved procedural skills (Hermes-style how-to memory). '
        + 'Skills belong only to this workspace+worker.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['list', 'run'],
          },
          skill_id: { type: 'string' },
        },
        required: ['action'],
      },
      execute: async (params) => {
        const ctx = getWorkerSessionContext(sessionId);
        if (!ctx) return { ok: false, error: 'No worker session context' };
        const action = String(params.action ?? '').trim();
        if (action === 'list') {
          const skills = await listWorkerSkills(ctx.worker.workspaceId, ctx.worker.id);
          return {
            ok: true,
            skills: skills.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              status: s.status,
              triggerHints: s.triggerHints,
            })),
          };
        }
        if (action === 'run') {
          const skillId = String(params.skill_id ?? '').trim();
          if (!skillId) return { ok: false, error: 'skill_id required' };
          try {
            const result = await runWorkerSkill(
              ctx.worker.workspaceId,
              ctx.worker.id,
              skillId,
            );
            return { ok: true, ...result };
          } catch (err) {
            return { ok: false, error: err instanceof Error ? err.message : String(err) };
          }
        }
        return { ok: false, error: `Unknown action: ${action}` };
      },
    },
  ];
}

export function registerWorkerMemorySessionTools(sessionId: string): void {
  for (const tool of createWorkerMemoryTools(sessionId)) {
    registerSessionTool(sessionId, tool);
  }
}
