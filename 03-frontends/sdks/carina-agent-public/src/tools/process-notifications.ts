import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { dispatchWebhook } from '../webhooks/dispatcher.js';

export interface ProcessCompletionEvent {
  sessionId: string;
  command: string;
  status: string;
  exitCode?: number;
  channel: ChannelName;
  conversationId: string;
  message: string;
}

type CompletionHandler = (event: ProcessCompletionEvent) => Promise<void>;

const pending: ProcessCompletionEvent[] = [];
let handler: CompletionHandler | null = null;

export function registerProcessCompletionHandler(fn: CompletionHandler): void {
  handler = fn;
  const queued = pending.splice(0);
  for (const event of queued) {
    void fn(event).catch(() => undefined);
  }
}

export async function emitProcessComplete(event: ProcessCompletionEvent): Promise<void> {
  void dispatchWebhook('process.complete', {
    session_id: event.sessionId,
    command: event.command,
    status: event.status,
    exit_code: event.exitCode,
    channel: event.channel,
    conversation_id: event.conversationId,
  });

  if (handler) {
    await handler(event);
    return;
  }
  pending.push(event);
}

export function drainPendingNotifications(): ProcessCompletionEvent[] {
  return pending.splice(0);
}
