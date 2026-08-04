import type { ClassifiedError } from './error-classifier.js';

export type StreamEventType =
  | 'token'
  | 'tool'
  | 'status'
  | 'meta'
  | 'error'
  | 'done';

export type StreamEvent = {
  type: StreamEventType;
  ts: string;
  sessionId?: string;
  turnId?: string;
  content?: string;
  error?: ClassifiedError;
  meta?: Record<string, unknown>;
};

export function streamEvent(
  type: StreamEventType,
  payload: Omit<StreamEvent, 'type' | 'ts'> & { ts?: string },
): StreamEvent {
  return {
    type,
    ts: payload.ts ?? new Date().toISOString(),
    sessionId: payload.sessionId,
    turnId: payload.turnId,
    content: payload.content,
    error: payload.error,
    meta: payload.meta,
  };
}

/** SSE frame with explicit event name for structured clients. */
export function formatStreamSseEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Legacy web UI expects bare string JSON in data lines.
 * Emit token chunks in the old shape while also supporting structured listeners.
 */
export function formatLegacyTokenChunk(text: string): string {
  return `data: ${JSON.stringify(text)}\n\n`;
}

export function formatStreamDone(): string {
  return 'data: [DONE]\n\n';
}

export function parseStreamPayload(raw: string): string | StreamEvent | null {
  if (raw === '[DONE]') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed as StreamEvent;
    }
    if (parsed && typeof parsed === 'object' && 'error' in parsed) {
      return String((parsed as { error: unknown }).error);
    }
  } catch {
    return raw;
  }
  return raw;
}
