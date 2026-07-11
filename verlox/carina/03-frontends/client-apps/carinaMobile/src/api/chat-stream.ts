import { normalizeStreamPayload } from '@/lib/stream-parser';
import type { ChatStreamChunk } from './types';

export interface StreamChatOptions {
  baseUrl: string;
  message: string;
  sessionId?: string;
  provider?: string;
  credentials?: RequestCredentials;
  apiKey?: string;
  pushNotify?: boolean;
  onChunk: (chunk: ChatStreamChunk) => void;
  onSessionId?: (sessionId: string) => void;
  signal?: AbortSignal;
}

export function buildStreamUrl(
  baseUrl: string,
  message: string,
  sessionId?: string,
  pushNotify?: boolean,
  provider?: string,
): string {
  const url = new URL('/api/chat/stream', baseUrl.replace(/\/+$/, ''));
  url.searchParams.set('message', message);
  if (sessionId) {
    url.searchParams.set('sessionId', sessionId);
  }
  if (provider) {
    url.searchParams.set('provider', provider);
  }
  if (pushNotify) {
    url.searchParams.set('notify', '1');
    url.searchParams.set('prompt', message.slice(0, 240));
  }
  return url.toString();
}

function friendlyStreamError(status: number, body: string): string {
  if (status === 429) {
    if (/quota|upgrade|token/i.test(body)) {
      return 'Usage limit reached. Open Billing in the app or on app.carinaai.uk to continue.';
    }
    return 'Too many requests. Wait a moment and try again.';
  }
  if (status === 401 || status === 403) {
    return 'Session expired. Sign in again to continue.';
  }
  const trimmed = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const snippet = trimmed.slice(0, 180);
  return snippet
    ? `Chat stream ${status}: ${snippet}`
    : `Chat stream ${status}: request failed`;
}

type StreamHandlers = {
  onChunk: (chunk: ChatStreamChunk) => void;
  onSessionId?: (sessionId: string) => void;
};

function consumeSseBuffer(
  buffer: string,
  handlers: StreamHandlers,
  fullText: string,
): { buffer: string; fullText: string; done: boolean } {
  const lines = buffer.split('\n');
  const rest = lines.pop() ?? '';
  let nextFull = fullText;
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const payload = line.slice(6).trim();
    if (payload === '[DONE]') {
      return { buffer: rest, fullText: nextFull, done: true };
    }
    const chunk = normalizeStreamPayload(payload);
    if (chunk.sessionId) handlers.onSessionId?.(chunk.sessionId);
    if (chunk.error) throw new Error(chunk.error);
    if (chunk.content) {
      nextFull += chunk.content;
      handlers.onChunk(chunk);
    }
  }
  return { buffer: rest, fullText: nextFull, done: false };
}

/**
 * React Native's fetch often has no ReadableStream body. XHR onprogress can
 * still deliver incremental SSE text.
 */
function streamChatWithXhr(
  url: string,
  options: StreamChatOptions,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let lastIndex = 0;
    let buffer = '';
    let fullText = '';
    let settled = false;
    let completedOk = false;

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener('abort', onAbort);
      if (err) reject(err);
      else resolve(fullText);
    };

    const onAbort = () => {
      xhr.abort();
      finish(new Error('Chat stream aborted'));
    };

    xhr.open('GET', url);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    if (options.apiKey) {
      xhr.setRequestHeader('Authorization', `Bearer ${options.apiKey}`);
    }
    xhr.withCredentials = (options.credentials ?? 'include') !== 'omit';

    const ingest = (chunkText: string) => {
      if (!chunkText || settled) return;
      buffer += chunkText;
      const next = consumeSseBuffer(buffer, options, fullText);
      buffer = next.buffer;
      fullText = next.fullText;
      if (next.done) {
        // Mark success before any abort cleanup so onabort does not reject.
        completedOk = true;
        finish();
      }
    };

    xhr.onprogress = () => {
      try {
        const text = xhr.responseText ?? '';
        const chunk = text.slice(lastIndex);
        lastIndex = text.length;
        ingest(chunk);
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    };

    xhr.onload = () => {
      try {
        const text = xhr.responseText ?? '';
        const chunk = text.slice(lastIndex);
        lastIndex = text.length;
        ingest(chunk);
        if (settled) return;
        if (xhr.status >= 200 && xhr.status < 300) {
          finish();
          return;
        }
        finish(new Error(friendlyStreamError(xhr.status, text || xhr.statusText)));
      } catch (err) {
        finish(err instanceof Error ? err : new Error(String(err)));
      }
    };

    xhr.onerror = () => finish(new Error('Chat stream network error'));
    xhr.onabort = () => {
      if (!settled && !completedOk) finish(new Error('Chat stream aborted'));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        finish(new Error('Chat stream aborted'));
        return;
      }
      options.signal.addEventListener('abort', onAbort);
    }

    xhr.send();
  });
}

async function streamChatWithFetch(
  url: string,
  options: StreamChatOptions,
): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (options.apiKey) {
    headers.Authorization = `Bearer ${options.apiKey}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: options.credentials ?? 'include',
    signal: options.signal,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(friendlyStreamError(response.status, body || response.statusText));
  }

  const reader = response.body?.getReader?.();
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
    const next = consumeSseBuffer(buffer, options, fullText);
    buffer = next.buffer;
    fullText = next.fullText;
    if (next.done) return fullText;
  }

  return fullText;
}

/**
 * Consumes Carina SSE stream (data: JSON lines, terminal data: [DONE]).
 * Prefer fetch streams when available; fall back to XHR for React Native.
 */
export async function streamChat(options: StreamChatOptions): Promise<string> {
  const url = buildStreamUrl(
    options.baseUrl,
    options.message,
    options.sessionId,
    options.pushNotify,
    options.provider,
  );

  try {
    return await streamChatWithFetch(url, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.includes('response body not readable')) throw err;
    return streamChatWithXhr(url, options);
  }
}
