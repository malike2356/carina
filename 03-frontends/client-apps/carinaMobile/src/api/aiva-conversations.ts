import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';
import {
  AivaApiError,
  buildAivaUrl,
  formatAivaApiError,
} from '@/api/aiva-client';

export type ConversationStatus = 'open' | 'escalated' | 'resolved' | 'automated' | string;

export interface AivaConversationSummary {
  id: string;
  contactId: string;
  channel: string;
  workerId: string;
  workerName: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  messageCount: number;
  hasEscalation: boolean;
  status: ConversationStatus;
}

export interface AivaConversationList {
  page: number;
  limit: number;
  total: number;
  conversations: AivaConversationSummary[];
}

export interface AivaThreadMessage {
  id: string;
  role: 'user' | 'aiva' | 'va' | 'system' | string;
  content: string;
  timestamp: string;
  actionType: string | null;
  summary: string | null;
}

export interface AivaConversationThread {
  id: string;
  channel: string;
  contactId: string;
  workerId: string;
  workerName: string;
  messageCount: number;
  startedAt: string | null;
  messages: AivaThreadMessage[];
  readOnly: true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function parseConversationSummary(raw: unknown): AivaConversationSummary | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  const worker = asRecord(row.worker) ?? {};
  return {
    id,
    contactId: asString(row.contactId),
    channel: asString(row.channel, 'unknown'),
    workerId: asString(worker.id ?? row.workerId),
    workerName: asString(worker.name ?? row.workerName, 'Employee'),
    lastMessageAt: asString(row.lastMessageAt) || null,
    lastMessagePreview: asString(row.lastMessagePreview),
    messageCount: Number(row.messageCount ?? 0),
    hasEscalation: Boolean(row.hasEscalation),
    status: asString(row.status, 'open'),
  };
}

export function parseConversationList(payload: unknown): AivaConversationList {
  const root = asRecord(payload) ?? {};
  const list = Array.isArray(root.conversations) ? root.conversations : [];
  return {
    page: Number(root.page ?? 1),
    limit: Number(root.limit ?? 30),
    total: Number(root.total ?? list.length),
    conversations: list
      .map((item) => parseConversationSummary(item))
      .filter((item): item is AivaConversationSummary => item !== null),
  };
}

export function parseThreadMessage(raw: unknown): AivaThreadMessage | null {
  const row = asRecord(raw);
  if (!row) return null;
  const id = asString(row.id);
  if (!id) return null;
  return {
    id,
    role: asString(row.role, 'system'),
    content: asString(row.content),
    timestamp: asString(row.timestamp),
    actionType: asString(row.actionType) || null,
    summary: asString(row.summary) || null,
  };
}

export function parseConversationThread(payload: unknown): AivaConversationThread {
  const root = asRecord(payload) ?? {};
  const conversation = asRecord(root.conversation) ?? root;
  const id = asString(conversation.id);
  if (!id) {
    throw new AivaApiError(500, 'Conversation thread missing id');
  }
  const worker = asRecord(conversation.worker) ?? {};
  const messages = Array.isArray(root.messages) ? root.messages : [];
  return {
    id,
    channel: asString(conversation.channel, 'unknown'),
    contactId: asString(conversation.contactId),
    workerId: asString(worker.id ?? conversation.workerId),
    workerName: asString(worker.name ?? conversation.workerName, 'Employee'),
    messageCount: Number(conversation.messageCount ?? messages.length),
    startedAt: asString(conversation.startedAt) || null,
    messages: messages
      .map((item) => parseThreadMessage(item))
      .filter((item): item is AivaThreadMessage => item !== null),
    readOnly: true,
  };
}

async function conversationsRequest<T>(
  baseUrl: string,
  path: string,
  auth: GatewayAuthOptions | undefined,
  label: string,
  parse: (payload: unknown) => T,
): Promise<T> {
  const response = await fetch(
    buildAivaUrl(baseUrl, path),
    mergeGatewayInit(auth, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }),
  );
  const text = await response.text();
  if (!response.ok) {
    throw formatAivaApiError(label, response.status, text, response.statusText);
  }
  if (!text.trim()) {
    throw new AivaApiError(response.status, `${label}: empty response`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new AivaApiError(response.status, `${label}: server returned non-JSON body`, {
      body: text,
    });
  }
  return parse(payload);
}

export function listConversations(
  baseUrl: string,
  auth?: GatewayAuthOptions,
  options?: { page?: number; limit?: number; workerId?: string; status?: string },
): Promise<AivaConversationList> {
  const params = new URLSearchParams();
  params.set('page', String(options?.page ?? 1));
  params.set('limit', String(options?.limit ?? 30));
  if (options?.workerId) params.set('workerId', options.workerId);
  if (options?.status) params.set('status', options.status);
  return conversationsRequest(
    baseUrl,
    `/api/conversations?${params.toString()}`,
    auth,
    'Aiva conversations',
    parseConversationList,
  );
}

export function fetchConversationThread(
  baseUrl: string,
  conversationId: string,
  auth?: GatewayAuthOptions,
): Promise<AivaConversationThread> {
  return conversationsRequest(
    baseUrl,
    `/api/conversations/${encodeURIComponent(conversationId)}/thread`,
    auth,
    'Aiva conversation thread',
    parseConversationThread,
  );
}
