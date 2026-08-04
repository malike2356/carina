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
  updateTrelloCardDesc,
  trelloConfigHint,
} from '../integrations/trello-client.js';

const WRITE_ACTIONS = new Set(['create-card', 'move-card', 'update-desc', 'archive-card', 'add-comment']);

function formatTrelloCardDetails(c: Awaited<ReturnType<typeof getTrelloCard>>): string {
  const labels = c.labels?.map((label) => label.name || label.color || label.id).join(', ') || 'none';
  const members = c.members?.map((member) => member.fullName || member.username).join(', ') || 'none';
  const checklists = c.checklists?.flatMap((checklist) => [
    `Checklist: ${checklist.name}`,
    ...checklist.checkItems.map((item) =>
      `  [${item.state === 'complete' ? 'x' : ' '}] ${item.name}${item.due ? ` (due ${item.due})` : ''}`),
  ]) ?? [];
  const attachments = c.attachments?.map((attachment) =>
    `Attachment: ${attachment.name} (${attachment.mimeType || 'unknown type'}) ${attachment.url}`) ?? [];
  const comments = c.actions?.filter((action) => action.type === 'commentCard').map((action) => {
    const author = action.memberCreator?.fullName || action.memberCreator?.username || 'Unknown member';
    return `Comment (${action.date}, ${author}): ${action.data?.text || ''}`;
  }) ?? [];

  return [
    `Name: ${c.name}`,
    `ID: ${c.id}`,
    `Board: ${c.idBoard || 'unknown'}`,
    `List: ${c.idList || 'unknown'}`,
    `Description: ${c.desc || '(none)'}`,
    `Start: ${c.start || 'none'}`,
    `Due: ${c.due || 'none'}`,
    `Due complete: ${c.dueComplete ? 'yes' : 'no'}`,
    `Archived: ${c.closed ? 'yes' : 'no'}`,
    `Labels: ${labels}`,
    `Members: ${members}`,
    ...checklists,
    ...attachments,
    ...comments,
    `URL: ${c.url}`,
  ].join('\n');
}

export const trelloTool: Tool = {
  name: 'trello',
  description:
    'Read and manage Trello. Use read-board to deeply read card descriptions, comments, checklists, labels, members, attachments, dates, and URLs across a board. Actions: list-boards, list-lists, list-cards, get-card, read-board, create-card, move-card, update-desc, add-comment, archive-card.',
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
          'read-board',
          'create-card',
          'move-card',
          'update-desc',
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
      maxCards: { type: 'number', description: 'Maximum cards to deep-read for read-board. Default 100, maximum 200.' },
    },
    required: ['action'],
  },
  needsConfirmation: (params) => WRITE_ACTIONS.has(String(params.action ?? '')),
  execute: async (params) => {
    const p = params as Record<string, string>;
    if (!(await isTrelloConfigured())) {
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
        return formatTrelloCardDetails(c);
      }
      case 'read-board': {
        if (!p.boardId) return 'boardId required';
        const requestedLimit = Number(params.maxCards ?? 100);
        const maxCards = Number.isFinite(requestedLimit)
          ? Math.min(200, Math.max(1, Math.floor(requestedLimit)))
          : 100;
        const lists = await listTrelloLists(p.boardId);
        const cardRows = (await Promise.all(lists.map(async (list) => ({
          list,
          cards: await listTrelloCards(list.id),
        })))).flatMap(({ list, cards }) => cards.map((card) => ({ list, card })));
        const selected = cardRows.slice(0, maxCards);
        const details = await Promise.all(selected.map(async ({ list, card }) => ({
          list,
          detail: await getTrelloCard(card.id),
        })));
        const sections = details.map(({ list, detail }) =>
          `List name: ${list.name}\n${formatTrelloCardDetails(detail)}`);
        const remaining = cardRows.length - selected.length;
        if (remaining > 0) {
          sections.push(
            `Truncated: ${remaining} additional cards were not read. Call read-board again with a higher maxCards, up to 200.`,
          );
        }
        return sections.join('\n\n---\n\n') || 'This board has no cards.';
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
      case 'update-desc': {
        if (!p.cardId) return 'cardId required';
        await updateTrelloCardDesc(p.cardId, p.desc ?? '');
        return `Description updated for card ${p.cardId}`;
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
