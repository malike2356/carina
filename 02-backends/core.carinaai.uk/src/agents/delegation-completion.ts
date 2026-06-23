import { dispatchWebhook } from '../webhooks/dispatcher.js';

export type DelegationCompletionEvent = {
  parentSessionId: string;
  subSessionId: string;
  goal: string;
  summary: string;
  mode: 'single' | 'batch';
  success: boolean;
  role?: string;
  durationMs?: number;
};

type CompletionHandler = (event: DelegationCompletionEvent) => void | Promise<void>;

const pending: DelegationCompletionEvent[] = [];
let handler: CompletionHandler | null = null;

export function registerDelegationCompletionHandler(fn: CompletionHandler): void {
  handler = fn;
  const queued = pending.splice(0);
  for (const event of queued) {
    void Promise.resolve(fn(event)).catch(() => undefined);
  }
}

export async function emitDelegationComplete(event: DelegationCompletionEvent): Promise<void> {
  void dispatchWebhook('delegation.complete', {
    parent_session_id: event.parentSessionId,
    sub_session_id: event.subSessionId,
    goal: event.goal,
    summary: event.summary,
    mode: event.mode,
    success: event.success,
    role: event.role,
    duration_ms: event.durationMs,
  });

  if (handler) {
    await handler(event);
    return;
  }
  pending.push(event);
}

export function drainPendingDelegationCompletions(): DelegationCompletionEvent[] {
  return pending.splice(0);
}
