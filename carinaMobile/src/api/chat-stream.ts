import { normalizeStreamPayload } from '@/lib/stream-parser';
import type { ChatStreamChunk } from './types';

export interface StreamChatOptions {
  baseUrl: string;
  message: string;
  sessionId?: string;
  credentials?: RequestCredentials;
  apiKey?: string;
  pushNotify?: boolean;
  onChunk: (chunk: ChatStreamChunk) => void;
  signal?: AbortSignal;
}

function buildStreamUrl(
  baseUrl: string,
  message: string,
  sessionId?: string,
  pushNotify?: boolean,
): string {
  const url = new URL('/api/chat/stream', baseUrl.replace(/\/+$/, ''));
  url.searchParams.set('message', message);
  if (sessionId) {
    url.searchParams.set('sessionId', sessionId);
  }
  if (pushNotify) {
    url.searchParams.set('notify', '1');
    url.searchParams.set('prompt', message.slice(0, 240));
  }
  return url.toString();
}

/**
 * Consumes Carina SSE stream (data: JSON lines, terminal data: [DONE]).
 * React Native has no native EventSource; use fetch + ReadableStream.
 */
export async function streamChat(options: StreamChatOptions): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(
    buildStreamUrl(options.baseUrl, options.message, options.sessionId, options.pushNotify),
    {
      method: 'GET',
      headers,
      credentials: options.credentials ?? 'include',
      signal: options.signal,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Chat stream ${response.status}: ${body || response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Chat stream: response body not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') return fullText;

      const chunk = normalizeStreamPayload(payload);
      if (chunk.error) throw new Error(chunk.error);
      if (chunk.content) {
        fullText += chunk.content;
        options.onChunk(chunk);
      }
    }
  }

  return fullText;
}
