import type { Tool } from '../types/index.js';
import {
  addTrelloComment,
  archiveTrelloCard,
  createTrelloCard,
  getTrelloCard,
  isTrelloConfigured,
  listTrelloBoards,
  listTrelloCards,
  listTrelloLists,
  moveTrelloCard,
  trelloConfigHint,
} from '../integrations/trello-client.js';

const WRITE_ACTIONS = new Set(['create-card', 'move-card', 'archive-card', 'add-comment']);

export const trelloTool: Tool = {
  name: 'trello',
  description:
    'Interact with Trello. Actions: list-boards, list-lists, list-cards, get-card, create-card, move-card, add-comment, archive-card.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'list-boards',
          'list-lists',
          'list-cards',
          'get-card',
          'create-card',
          'move-card',
          'add-comment',
          'archive-card',
        ],
      },
      boardId: { type: 'string' },
      listId: { type: 'string' },
      cardId: { type: 'string' },
      name: { type: 'string' },
      desc: { type: 'string' },
      text: { type: 'string' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => WRITE_ACTIONS.has(String(params.action ?? '')),
  execute: async (params) => {
    const p = params as Record<string, string>;
    if (!isTrelloConfigured()) {
      return trelloConfigHint();
    }
    switch (p.action) {
      case 'list-boards': {
        const boards = await listTrelloBoards();
        return boards.map((b) => `${b.name} (${b.id}): ${b.url}`).join('\n');
      }
      case 'list-lists': {
        if (!p.boardId) return 'boardId required';
        const lists = await listTrelloLists(p.boardId);
        return lists.map((l) => `${l.name} (${l.id})`).join('\n');
      }
      case 'list-cards': {
        if (!p.listId) return 'listId required';
        const cards = await listTrelloCards(p.listId);
        return cards
          .map((c) => `${c.name} (${c.id})${c.due ? ` due:${c.due.slice(0, 10)}` : ''}\n  ${c.url}`)
          .join('\n');
      }
      case 'get-card': {
        if (!p.cardId) return 'cardId required';
        const c = await getTrelloCard(p.cardId);
        return [
          `Name: ${c.name}`,
          `ID: ${c.id}`,
          `List: ${c.idList}`,
          `Desc: ${c.desc || '(none)'}`,
          `Due: ${c.due || 'none'}`,
          `URL: ${c.url}`,
        ].join('\n');
      }
      case 'create-card': {
        if (!p.listId || !p.name) return 'listId and name required';
        const c = await createTrelloCard({ listId: p.listId, name: p.name, desc: p.desc });
        return `Created: ${c.name} (${c.id}) at ${c.url}`;
      }
      case 'move-card': {
        if (!p.cardId || !p.listId) return 'cardId and listId (destination) required';
        await moveTrelloCard(p.cardId, p.listId);
        return `Card ${p.cardId} moved to list ${p.listId}`;
      }
      case 'add-comment': {
        if (!p.cardId || !p.text) return 'cardId and text required';
        await addTrelloComment(p.cardId, p.text);
        return `Comment added to card ${p.cardId}`;
      }
      case 'archive-card': {
        if (!p.cardId) return 'cardId required';
        await archiveTrelloCard(p.cardId);
        return `Card ${p.cardId} archived`;
      }
      default:
        return `Unknown action: ${p.action}`;
    }
  },
};
