// Desktop stream events. Supports the structured prompt shape and the live Carina gateway SSE format.

export type StreamEvent =
  | { type: 'token'; content: string; messageId: string }
  | { type: 'thinking'; content: string; messageId: string }
  | { type: 'tool.start'; toolCallId: string; name: string; args: unknown; messageId: string }
  | { type: 'tool.progress'; toolCallId: string; progress?: string }
  | { type: 'tool.complete'; toolCallId: string; result: unknown; durationMs: number }
  | { type: 'tool.error'; toolCallId: string; error: string }
  | { type: 'message.complete'; messageId: string; model?: string; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'approval.request'; toolName: string; params: unknown; reason: string; runId: string; level: 'on-miss' | 'full' }
  | { type: 'error'; message: string }
  | { type: 'done' };

type GatewayStreamEvent = {
  type?: string;
  content?: string;
  sessionId?: string;
  turnId?: string;
  error?: { message?: string } | string;
  meta?: Record<string, unknown>;
};

function messageIdFromTurn(turnId: string): string {
  return `msg-${turnId}`;
}

function mapGatewayEvent(raw: string, eventName?: string): StreamEvent | null {
  if (raw === '[DONE]') return { type: 'done' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (raw.trim()) {
      return { type: 'token', content: raw, messageId: 'stream' };
    }
    return null;
  }

  if (typeof parsed === 'string') {
    return { type: 'token', content: parsed, messageId: 'stream' };
  }

  if (!parsed || typeof parsed !== 'object') return null;

  const record = parsed as Record<string, unknown>;

  if ('type' in record && typeof record.type === 'string') {
    const promptEvent = parsed as StreamEvent;
    if (promptEvent.type === 'token' || promptEvent.type === 'thinking') {
      return promptEvent;
    }
    if (promptEvent.type === 'tool.start' || promptEvent.type === 'tool.complete') {
      return promptEvent;
    }
    if (promptEvent.type === 'approval.request') {
      return promptEvent;
    }
    if (promptEvent.type === 'done' || promptEvent.type === 'error') {
      return promptEvent;
    }
  }

  const gateway = parsed as GatewayStreamEvent;
  const turnId = gateway.turnId ?? 'stream';
  const messageId = messageIdFromTurn(turnId);
  const type = eventName ?? gateway.type;

  if (type === 'status' && gateway.content === 'thinking') {
    return { type: 'thinking', content: '', messageId };
  }

  if (type === 'token' && typeof gateway.content === 'string') {
    return { type: 'token', content: gateway.content, messageId };
  }

  if (type === 'tool') {
    const meta = gateway.meta ?? {};
    const toolCallId = String(meta.toolCallId ?? meta.id ?? `${turnId}-tool`);
    const name = String(meta.name ?? meta.toolName ?? 'tool');
    const phase = String(meta.phase ?? meta.status ?? 'start');
    if (phase === 'complete' || phase === 'done') {
      return {
        type: 'tool.complete',
        toolCallId,
        result: meta.result ?? gateway.content ?? '',
        durationMs: Number(meta.durationMs ?? 0),
      };
    }
    if (phase === 'error') {
      return {
        type: 'tool.error',
        toolCallId,
        error: String(meta.error ?? gateway.content ?? 'Tool failed'),
      };
    }
    return {
      type: 'tool.start',
      toolCallId,
      name,
      args: meta.args ?? meta.params ?? {},
      messageId,
    };
  }

  if (type === 'meta') {
    return null;
  }

  if (type === 'error') {
    const message = typeof gateway.error === 'string'
      ? gateway.error
      : String(gateway.error?.message ?? gateway.content ?? 'Stream error');
    return { type: 'error', message };
  }

  if (type === 'done') {
    return { type: 'done' };
  }

  if ('error' in record) {
    return { type: 'error', message: String(record.error) };
  }

  return null;
}

export function parseStreamEvent(raw: string, eventName?: string): StreamEvent | null {
  const mapped = mapGatewayEvent(raw, eventName);
  if (!mapped) return null;

  if (mapped.type === 'token' && mapped.messageId === 'stream') {
    return mapped;
  }

  return mapped;
}
