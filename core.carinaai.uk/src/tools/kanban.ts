import type { Tool } from '../types/index.js';
import type { KanbanColumn } from '../agents/kanban-types.js';
import { getCard, removeCard } from '../agents/kanban-store.js';
import {
  createBoardCard,
  getBoardView,
  orchestratorCloseCard,
  patchCard,
  runCardWork,
  transitionCard,
  workerClaimCard,
  workerReleaseCard,
} from '../agents/kanban-service.js';

const COLUMNS: KanbanColumn[] = ['backlog', 'in_progress', 'review', 'done'];

function parseColumn(value: unknown): KanbanColumn {
  const col = String(value ?? 'backlog') as KanbanColumn;
  return COLUMNS.includes(col) ? col : 'backlog';
}

function parseRole(value: unknown): 'orchestrator' | 'worker' {
  return String(value ?? 'orchestrator').toLowerCase() === 'worker' ? 'worker' : 'orchestrator';
}

export function createKanbanTool(sessionId: string): Tool {
  return {
    name: 'kanban',
    dangerous: true,
    requiresConfirmation: true,
    description:
      'Operator Kanban board for multi-step agent work. Roles: orchestrator (create, assign work, close) or worker (claim, release, submit for review). Columns: backlog, in_progress, review, done. Actions: add, board, move, claim, release, close, update, run, remove.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'board', 'move', 'claim', 'release', 'close', 'update', 'run', 'remove'],
        },
        role: { type: 'string', enum: ['orchestrator', 'worker'], description: 'Actor role (default orchestrator)' },
        board_id: { type: 'string', description: 'Board identifier (default: default)' },
        card_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        column: { type: 'string', enum: COLUMNS },
        priority: { type: 'number' },
        work_prompt: { type: 'string', description: 'Instructions for agent when running card work' },
        orchestrator_notes: { type: 'string' },
        assignee: { type: 'string', description: 'Worker name for claim/release' },
        version: { type: 'number', description: 'Optimistic lock version for updates' },
        toolsets: {
          type: 'array',
          items: { type: 'string' },
          description: 'For run: toolsets for the subagent',
        },
      },
      required: ['action'],
    },
    execute: async (params) => {
      const action = String(params.action ?? '');
      const sid = String(params._sessionId ?? sessionId);
      const boardId = String(params.board_id ?? 'default');
      const role = parseRole(params.role);

      if (action === 'add') {
        const title = String(params.title ?? '').trim();
        if (!title) return { error: 'title is required for add' };
        const card = await createBoardCard(role, {
          sessionId: sid,
          boardId,
          title,
          description: params.description ? String(params.description) : undefined,
          column: parseColumn(params.column),
          priority: params.priority != null ? Number(params.priority) : undefined,
          workPrompt: params.work_prompt ? String(params.work_prompt) : undefined,
          orchestratorNotes: params.orchestrator_notes ? String(params.orchestrator_notes) : undefined,
        });
        return { card };
      }

      if (action === 'board') {
        return getBoardView(sid, boardId);
      }

      const cardId = String(params.card_id ?? '').trim();
      if (!cardId && action !== 'board' && action !== 'add') {
        return { error: 'card_id is required' };
      }

      if (action === 'move') {
        const column = parseColumn(params.column);
        const card = await transitionCard(role, cardId, column, {
          assignee: params.assignee ? String(params.assignee) : undefined,
          expectedVersion: params.version != null ? Number(params.version) : undefined,
          actor: params.assignee ? String(params.assignee) : undefined,
        });
        return { card };
      }

      if (action === 'claim') {
        const assignee = String(params.assignee ?? 'subagent');
        const card = await workerClaimCard(
          cardId,
          assignee,
          params.version != null ? Number(params.version) : undefined,
        );
        return { card };
      }

      if (action === 'release') {
        const assignee = String(params.assignee ?? 'subagent');
        const card = await workerReleaseCard(
          cardId,
          assignee,
          params.version != null ? Number(params.version) : undefined,
        );
        return { card };
      }

      if (action === 'close') {
        const card = await orchestratorCloseCard(
          cardId,
          params.version != null ? Number(params.version) : undefined,
        );
        return { card };
      }

      if (action === 'update') {
        const card = await patchCard(role, cardId, {
          expectedVersion: params.version != null ? Number(params.version) : undefined,
          title: params.title ? String(params.title) : undefined,
          description: params.description !== undefined ? String(params.description) : undefined,
          priority: params.priority != null ? Number(params.priority) : undefined,
          workPrompt: params.work_prompt !== undefined ? String(params.work_prompt) : undefined,
          orchestratorNotes: params.orchestrator_notes !== undefined
            ? String(params.orchestrator_notes)
            : undefined,
        });
        return { card };
      }

      if (action === 'run') {
        if (role !== 'orchestrator') return { error: 'Only orchestrators can run card work' };
        const toolsets = Array.isArray(params.toolsets)
          ? (params.toolsets as string[]).map(String)
          : undefined;
        return runCardWork(sid, cardId, toolsets);
      }

      if (action === 'remove') {
        if (role !== 'orchestrator') return { error: 'Only orchestrators can remove cards' };
        const existing = await getCard(cardId);
        if (!existing) return { error: 'card not found' };
        const ok = await removeCard(cardId);
        return ok ? { card_id: cardId, status: 'removed' } : { error: 'card not found' };
      }

      return { error: `unknown action: ${action}` };
    },
  };
}
