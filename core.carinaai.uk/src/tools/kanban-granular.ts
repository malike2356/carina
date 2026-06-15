import type { Tool } from '../types/index.js';
import {
  addComment,
  blockCard,
  completeCard,
  createCard,
  heartbeatBoard,
  linkCards,
  listCards,
  listComments,
  showBoard,
  unblockCard,
  type KanbanColumn,
} from '../agents/kanban-store.js';
import { cardToPayload } from '../agents/kanban-workflow.js';

const COLUMNS: KanbanColumn[] = ['backlog', 'in_progress', 'review', 'done', 'blocked'];

function sid(params: Record<string, unknown>, fallback: string): string {
  return String(params._sessionId ?? fallback);
}

function cardPayload(c: Parameters<typeof cardToPayload>[0]) {
  return cardToPayload(c);
}

export function createKanbanGranularTools(sessionId: string): Tool[] {
  const base = { board_id: { type: 'string' }, card_id: { type: 'string' } };

  return [
    {
      name: 'kanban-show',
      description: 'Show the full Kanban board grouped by column.',
      parameters: { type: 'object', properties: { board_id: base.board_id } },
      execute: async (params) => {
        const grouped = await showBoard(sid(params, sessionId), String(params.board_id ?? 'default'));
        return {
          board_id: String(params.board_id ?? 'default'),
          columns: Object.fromEntries(
            COLUMNS.map((col) => [
              col,
              grouped[col].map(cardPayload),
            ]),
          ),
        };
      },
    },
    {
      name: 'kanban-list',
      description: 'List Kanban cards, optionally filtered by column.',
      parameters: {
        type: 'object',
        properties: { board_id: base.board_id, column: { type: 'string', enum: COLUMNS } },
      },
      execute: async (params) => {
        const cards = await listCards(
          sid(params, sessionId),
          String(params.board_id ?? 'default'),
          params.column ? String(params.column) as KanbanColumn : undefined,
        );
        return { cards: cards.map(cardPayload) };
      },
    },
    {
      name: 'kanban-create',
      dangerous: true,
      description: 'Create a new Kanban card.',
      parameters: {
        type: 'object',
        properties: {
          board_id: base.board_id,
          title: { type: 'string' },
          description: { type: 'string' },
          column: { type: 'string', enum: COLUMNS },
          priority: { type: 'number' },
        },
        required: ['title'],
      },
      execute: async (params) => {
        const title = String(params.title ?? '').trim();
        if (!title) return { error: 'title is required' };
        const card = await createCard({
          sessionId: sid(params, sessionId),
          boardId: String(params.board_id ?? 'default'),
          title,
          description: params.description ? String(params.description) : undefined,
          column: params.column ? String(params.column) as KanbanColumn : undefined,
          priority: params.priority != null ? Number(params.priority) : undefined,
        });
        return cardPayload(card);
      },
    },
    {
      name: 'kanban-complete',
      dangerous: true,
      description: 'Mark a Kanban card as done.',
      parameters: { type: 'object', properties: { card_id: base.card_id }, required: ['card_id'] },
      execute: async (params) => {
        const card = await completeCard(String(params.card_id ?? ''));
        return card ? cardPayload(card) : { error: 'card not found' };
      },
    },
    {
      name: 'kanban-block',
      dangerous: true,
      description: 'Block a Kanban card with a reason.',
      parameters: {
        type: 'object',
        properties: { card_id: base.card_id, reason: { type: 'string' } },
        required: ['card_id', 'reason'],
      },
      execute: async (params) => {
        const card = await blockCard(String(params.card_id ?? ''), String(params.reason ?? ''));
        return card ? cardPayload(card) : { error: 'card not found' };
      },
    },
    {
      name: 'kanban-unblock',
      dangerous: true,
      description: 'Unblock a Kanban card.',
      parameters: { type: 'object', properties: { card_id: base.card_id }, required: ['card_id'] },
      execute: async (params) => {
        const card = await unblockCard(String(params.card_id ?? ''));
        return card ? cardPayload(card) : { error: 'card not found' };
      },
    },
    {
      name: 'kanban-link',
      dangerous: true,
      description: 'Link two Kanban cards together.',
      parameters: {
        type: 'object',
        properties: { card_id: base.card_id, linked_card_id: { type: 'string' } },
        required: ['card_id', 'linked_card_id'],
      },
      execute: async (params) => {
        const card = await linkCards(String(params.card_id ?? ''), String(params.linked_card_id ?? ''));
        return card ? cardPayload(card) : { error: 'card not found' };
      },
    },
    {
      name: 'kanban-comment',
      dangerous: true,
      description: 'Add a comment to a Kanban card.',
      parameters: {
        type: 'object',
        properties: {
          card_id: base.card_id,
          body: { type: 'string' },
          author: { type: 'string' },
        },
        required: ['card_id', 'body'],
      },
      execute: async (params) => {
        const comment = await addComment(
          String(params.card_id ?? ''),
          String(params.body ?? ''),
          params.author ? String(params.author) : 'agent',
        );
        return { comment_id: comment.id, card_id: comment.cardId, body: comment.body };
      },
    },
    {
      name: 'kanban-heartbeat',
      dangerous: true,
      description: 'Board health check: counts, blocked cards, stale in-progress items.',
      parameters: { type: 'object', properties: { board_id: base.board_id } },
      execute: async (params) => {
        const hb = await heartbeatBoard(sid(params, sessionId), String(params.board_id ?? 'default'));
        return {
          ...hb,
          stale: hb.stale.map(cardPayload),
        };
      },
    },
  ];
}

export { listComments };
