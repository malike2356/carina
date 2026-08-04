import { config } from '../config/index.js';
import {
  resolveTrelloCredentials,
  trelloConfigHint,
  isTrelloConfigured,
} from './trello-credentials.js';

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
  start?: string;
  url: string;
  idList?: string;
  idBoard?: string;
  closed?: boolean;
  dueComplete?: boolean;
  labels?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
  members?: Array<{
    id: string;
    fullName: string;
    username?: string;
  }>;
  checklists?: Array<{
    id: string;
    name: string;
    checkItems: Array<{
      id: string;
      name: string;
      state: 'complete' | 'incomplete';
      due?: string;
    }>;
  }>;
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    mimeType?: string;
    date?: string;
  }>;
  actions?: Array<{
    id: string;
    date: string;
    type: string;
    data?: {
      text?: string;
    };
    memberCreator?: {
      fullName: string;
      username?: string;
    };
  }>;
};

function trelloBase(): string {
  return config.trello.baseUrl.replace(/\/$/, '');
}

function authQuery(credentials: { apiKey: string; token: string }): string {
  return `key=${encodeURIComponent(credentials.apiKey)}&token=${encodeURIComponent(credentials.token)}`;
}

function urlWithAuth(path: string, credentials: { apiKey: string; token: string }): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${trelloBase()}${path}${sep}${authQuery(credentials)}`;
}

async function requireCredentials(): Promise<{ apiKey: string; token: string }> {
  const credentials = await resolveTrelloCredentials();
  if (!credentials) {
    throw new Error(trelloConfigHint());
  }
  return credentials;
}

async function trelloJson<T>(path: string): Promise<T> {
  const credentials = await requireCredentials();
  const res = await fetch(urlWithAuth(path, credentials), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

async function trelloWrite<T>(path: string, method: 'POST' | 'PUT', body: Record<string, string>): Promise<T> {
  const credentials = await requireCredentials();
  const p = new URLSearchParams({
    ...body,
    key: credentials.apiKey,
    token: credentials.token,
  });
  const res = await fetch(`${trelloBase()}${path}`, {
    method,
    body: p,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Trello HTTP ${res.status} on ${method} ${path}`);
  return res.json() as Promise<T>;
}

export { isTrelloConfigured, trelloConfigHint };

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
  return trelloJson<TrelloCard>(
    `/cards/${cardId}`
      + '?fields=id,name,desc,due,start,dueComplete,url,idList,idBoard,closed,labels'
      + '&members=true&member_fields=id,fullName,username'
      + '&checklists=all&checklist_fields=id,name&checkItem_fields=id,name,state,due'
      + '&attachments=true&attachment_fields=id,name,url,mimeType,date'
      + '&actions=commentCard&actions_limit=100&action_fields=id,date,type,data'
      + '&action_memberCreator_fields=fullName,username',
  );
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

export async function updateTrelloCardDesc(cardId: string, desc: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}`, 'PUT', { desc });
}

export async function addTrelloComment(cardId: string, text: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}/actions/comments`, 'POST', { text });
}

export async function archiveTrelloCard(cardId: string): Promise<void> {
  await trelloWrite(`/cards/${cardId}`, 'PUT', { closed: 'true' });
}
