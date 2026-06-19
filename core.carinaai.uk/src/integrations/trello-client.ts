import { config } from '../config/index.js';

export type TrelloBoard = {
  id: string;
  name: string;
  url: string;
};

export type TrelloList = {
  id: string;
  name: string;
};

export type TrelloCard = {
  id: string;
  name: string;
  desc?: string;
  due?: string;
  url: string;
  idList?: string;
  closed?: boolean;
};

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

function assertConfigured(): void {
  if (!config.trello.apiKey || !config.trello.token) {
    throw new Error('Trello is not configured. Set TRELLO_API_KEY and TRELLO_TOKEN. Get them at https://trello.com/app-key');
  }
}

async function trelloJson<T>(path: string): Promise<T> {
  assertConfigured();
  const res = await fetch(urlWithAuth(path), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function trelloWrite<T>(path: string, method: 'POST' | 'PUT', body: Record<string, string>): Promise<T> {
  assertConfigured();
  const p = new URLSearchParams({
    ...body,
    key: config.trello.apiKey,
    token: config.trello.token,
  });
  const res = await fetch(`${trelloBase()}${path}`, {
    method,
    body: p,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on ${method} ${path}`);
  return res.json() as Promise<T>;
}

export function isTrelloConfigured(): boolean {
  return Boolean(config.trello.apiKey && config.trello.token);
}

export function trelloConfigHint(): string {
  return 'Trello is not configured. Set TRELLO_API_KEY and TRELLO_TOKEN. Get them at https://trello.com/app-key';
}

export async function listTrelloBoards(): Promise<TrelloBoard[]> {
  return trelloJson<TrelloBoard[]>('/members/me/boards?fields=id,name,url');
}

export async function listTrelloLists(boardId: string): Promise<TrelloList[]> {
  return trelloJson<TrelloList[]>(`/boards/${boardId}/lists?fields=id,name`);
}

export async function listTrelloCards(listId: string): Promise<TrelloCard[]> {
  return trelloJson<TrelloCard[]>(`/lists/${listId}/cards?fields=id,name,desc,due,url,idList,closed`);
}

export async function getTrelloCard(cardId: string): Promise<TrelloCard> {
  return trelloJson<TrelloCard>(`/cards/${cardId}?fields=id,name,desc,due,url,idList,closed`);
}

export async function createTrelloCard(params: { listId: string; name: string; desc?: string }): Promise<TrelloCard> {
  return trelloWrite<TrelloCard>('/cards', 'POST', {
    idList: params.listId,
    name: params.name,
    desc: params.desc ?? '',
  });
}

export async function moveTrelloCard(cardId: string, listId: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}`, 'PUT', { idList: listId });
}

export async function addTrelloComment(cardId: string, text: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}/actions/comments`, 'POST', { text });
}

export async function archiveTrelloCard(cardId: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}`, 'PUT', { closed: 'true' });
}
