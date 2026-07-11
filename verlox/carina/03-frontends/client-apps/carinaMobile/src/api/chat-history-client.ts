import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

export interface ChatHistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  source?: string;
}

export interface ChatHistoryResponse {
  sessionId: string;
  messages: ChatHistoryMessage[];
  hasMore: boolean;
  oldestMessageId: string | null;
  newestMessageId: string | null;
}

export async function fetchChatHistory(
  baseUrl: string,
  sessionId: string,
  options?: { limit?: number; before?: string; auth?: GatewayAuthOptions },
): Promise<ChatHistoryResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.before) params.set('before', options.before);

  const url = `${baseUrl.replace(/\/+$/, '')}/api/chat/history/${encodeURIComponent(sessionId)}?${params}`;
  const response = await fetch(url, mergeGatewayInit(options?.auth, { method: 'GET' }));

  if (response.status === 404) {
    return {
      sessionId,
      messages: [],
      hasMore: false,
      oldestMessageId: null,
      newestMessageId: null,
    };
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`History fetch ${response.status}: ${body || response.statusText}`);
  }

  return response.json() as Promise<ChatHistoryResponse>;
}
