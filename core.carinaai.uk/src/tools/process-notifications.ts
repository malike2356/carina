import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import { dispatchWebhook } from '../webhooks/dispatcher.js';
import type { WebhookEvent } from '../webhooks/webhook-types.js';

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

async function dispatchProcessEvent(
  webhookEvent: WebhookEvent,
  event: ProcessCompletionEvent,
): Promise<void> {
  void dispatchWebhook(webhookEvent, {
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

export async function emitProcessComplete(event: ProcessCompletionEvent): Promise<void> {
  await dispatchProcessEvent('process.complete', event);
}

export async function emitProcessFailure(event: ProcessCompletionEvent): Promise<void> {
  await dispatchProcessEvent('process.failure', event);
}

export interface ProcessWatchEvent extends ProcessCompletionEvent {
  pattern: string;
}

export async function emitProcessWatch(event: ProcessWatchEvent): Promise<void> {
  void dispatchWebhook('process.watch', {
    session_id: event.sessionId,
    command: event.command,
    status: event.status,
    channel: event.channel,
    conversation_id: event.conversationId,
    pattern: event.pattern,
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
