import type { Tool } from '../types/index.js';
import { config } from '../config/index.js';

function trelloBase(): string {
  return config.trello.baseUrl.replace(/\/$/, '');
}

function authQuery(): string {
  return `key=${encodeURIComponent(config.trello.apiKey)}&token=${encodeURIComponent(config.trello.token)}`;
}

function urlWithAuth(path: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${trelloBase()}${path}${sep}${authQuery()}`;
}

async function tGet(path: string): Promise<unknown> {
  const res = await fetch(urlWithAuth(path), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on ${path}`);
  return res.json();
}

async function tPost(path: string, body: Record<string, string>): Promise<unknown> {
  const p = new URLSearchParams({
    ...body,
    key: config.trello.apiKey,
    token: config.trello.token,
  });
  const res = await fetch(`${trelloBase()}${path}`, {
    method: 'POST',
    body: p,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on POST ${path}`);
  return res.json();
}

async function tPut(path: string, body: Record<string, string>): Promise<unknown> {
  const p = new URLSearchParams({
    ...body,
    key: config.trello.apiKey,
    token: config.trello.token,
  });
  const res = await fetch(`${trelloBase()}${path}`, {
    method: 'PUT',
    body: p,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on PUT ${path}`);
  return res.json();
}

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
    if (!config.trello.apiKey || !config.trello.token) {
      return 'Trello is not configured. Set TRELLO_API_KEY and TRELLO_TOKEN. Get them at https://trello.com/app-key';
    }
    switch (p.action) {
      case 'list-boards': {
        const boards = await tGet('/members/me/boards?fields=id,name,url') as Array<{
          id: string;
          name: string;
          url: string;
        }>;
        return boards.map((b) => `${b.name} (${b.id}): ${b.url}`).join('\n');
      }
      case 'list-lists': {
        if (!p.boardId) return 'boardId required';
        const lists = await tGet(`/boards/${p.boardId}/lists?fields=id,name`) as Array<{
          id: string;
          name: string;
        }>;
        return lists.map((l) => `${l.name} (${l.id})`).join('\n');
      }
      case 'list-cards': {
        if (!p.listId) return 'listId required';
        const cards = await tGet(`/lists/${p.listId}/cards?fields=id,name,due,url`) as Array<{
          id: string;
          name: string;
          due?: string;
          url: string;
        }>;
        return cards
          .map((c) => `${c.name} (${c.id})${c.due ? ` due:${c.due.slice(0, 10)}` : ''}\n  ${c.url}`)
          .join('\n');
      }
      case 'get-card': {
        if (!p.cardId) return 'cardId required';
        const c = await tGet(`/cards/${p.cardId}?fields=id,name,desc,due,url,idList`) as Record<string, string>;
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
        const c = await tPost('/cards', {
          idList: p.listId,
          name: p.name,
          desc: p.desc ?? '',
        }) as Record<string, string>;
        return `Created: ${c.name} (${c.id}) at ${c.url}`;
      }
      case 'move-card': {
        if (!p.cardId || !p.listId) return 'cardId and listId (destination) required';
        await tPut(`/cards/${p.cardId}`, { idList: p.listId });
        return `Card ${p.cardId} moved to list ${p.listId}`;
      }
      case 'add-comment': {
        if (!p.cardId || !p.text) return 'cardId and text required';
        await tPost(`/cards/${p.cardId}/actions/comments`, { text: p.text });
        return `Comment added to card ${p.cardId}`;
      }
      case 'archive-card': {
        if (!p.cardId) return 'cardId required';
        await tPut(`/cards/${p.cardId}`, { closed: 'true' });
        return `Card ${p.cardId} archived`;
      }
      default:
        return `Unknown action: ${p.action}`;
    }
  },
};
