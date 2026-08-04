import type { Tool } from '../types/index.js';
import {
  addCard,
  getCard,
  groupByColumn,
  listCards,
  moveCard,
  removeCard,
  type KanbanColumn,
} from '../agents/kanban-store.js';
import { GenericSubAgent } from '../agents/generic-sub-agent.js';
import {
  canDelegate,
  createChildAbortController,
  getDelegationDepth,
  releaseChildAbortController,
  setDelegationDepth,
  clearDelegationDepth,
} from '../agents/delegation-context.js';
import { resolveToolset } from './toolset.js';

const COLUMNS: KanbanColumn[] = ['backlog', 'in_progress', 'review', 'done'];

function parseColumn(value: unknown): KanbanColumn {
  const col = String(value ?? 'backlog') as KanbanColumn;
  return COLUMNS.includes(col) ? col : 'backlog';
}

export function createKanbanTool(sessionId: string): Tool {
  return {
    name: 'kanban',
    description:
      'Multi-agent work queue board. Columns: backlog, in_progress, review, done. Actions: add, board, move, assign, remove.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'board', 'move', 'assign', 'remove'],
        },
        board_id: { type: 'string', description: 'Board identifier (default: default)' },
        card_id: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        column: {
          type: 'string',
          enum: COLUMNS,
        },
        priority: { type: 'number' },
        toolsets: {
          type: 'array',
          items: { type: 'string' },
          description: 'For assign: toolsets for the subagent',
        },
      },
      required: ['action'],
    },
    execute: async (params) => {
      const action = String(params.action ?? '');
      const sid = String(params._sessionId ?? sessionId);
      const boardId = String(params.board_id ?? 'default');

      if (action === 'add') {
        const title = String(params.title ?? '').trim();
        if (!title) return { error: 'title is required for add' };
        const card = await addCard({
          sessionId: sid,
          boardId,
          title,
          description: params.description ? String(params.description) : undefined,
          column: parseColumn(params.column),
          priority: params.priority != null ? Number(params.priority) : undefined,
        });
        return { card_id: card.id, column: card.column, title: card.title };
      }

      if (action === 'board') {
        const cards = await listCards(sid, boardId);
        const grouped = groupByColumn(cards);
        return {
          board_id: boardId,
          columns: Object.fromEntries(
            COLUMNS.map((col) => [
              col,
              grouped[col].map((c) => ({
                card_id: c.id,
                title: c.title,
                description: c.description,
                assignee: c.assignee,
                priority: c.priority,
              })),
            ]),
          ),
        };
      }

      const cardId = String(params.card_id ?? '').trim();
      if (!cardId && action !== 'board' && action !== 'add') {
        return { error: 'card_id is required' };
      }

      if (action === 'move') {
        const column = parseColumn(params.column);
        const card = await moveCard(cardId, column);
        return card
          ? { card_id: card.id, column: card.column, title: card.title }
          : { error: 'card not found' };
      }

      if (action === 'remove') {
        const ok = await removeCard(cardId);
        return ok ? { card_id: cardId, status: 'removed' } : { error: 'card not found' };
      }

      if (action === 'assign') {
        if (!canDelegate(sid)) {
          return { error: 'Delegation depth limit reached.' };
        }

        const card = await getCard(cardId);
        if (!card) return { error: 'card not found' };

        await moveCard(cardId, 'in_progress', 'subagent');

        const toolsets = Array.isArray(params.toolsets)
          ? (params.toolsets as string[]).map(String)
          : ['terminal', 'file', 'web'];
        const allowedTools = resolveToolset(toolsets);
        const childDepth = getDelegationDepth(sid) + 1;
        const childAbort = createChildAbortController(sid);
        const subSessionId = `${sid}:kanban:${cardId}`;

        try {
          setDelegationDepth(subSessionId, childDepth);
          const agent = new GenericSubAgent(
            subSessionId,
            card.title,
            allowedTools,
            undefined,
            undefined,
            childDepth,
            childAbort.signal,
          );
          const prompt = card.description
            ? `${card.description}\n\nTask: ${card.title}`
            : card.title;
          const summary = await agent.run(prompt);
          await moveCard(cardId, 'review');
          return { card_id: cardId, status: 'review', summary };
        } catch (err) {
          await moveCard(cardId, 'backlog');
          const msg = err instanceof Error ? err.message : String(err);
          return { error: msg, card_id: cardId, status: 'backlog' };
        } finally {
          releaseChildAbortController(sid, childAbort);
          clearDelegationDepth(subSessionId);
        }
      }

      return { error: `unknown action: ${action}` };
    },
  };
}
