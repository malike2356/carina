const controllers = new Map<string, AbortController>();

function key(sessionId: string, turnId: string): string {
  return `${sessionId}:${turnId}`;
}

export function registerStreamSession(sessionId: string, turnId: string): AbortController {
  const id = key(sessionId, turnId);
  const existing = controllers.get(id);
  if (existing) existing.abort();
  const controller = new AbortController();
  controllers.set(id, controller);
  return controller;
}

export function getStreamAbortSignal(sessionId: string, turnId: string): AbortSignal | undefined {
  return controllers.get(key(sessionId, turnId))?.signal;
}

export function cancelStreamSession(sessionId: string, turnId: string): boolean {
  const id = key(sessionId, turnId);
  const controller = controllers.get(id);
  if (!controller) return false;
  controller.abort();
  controllers.delete(id);
  return true;
}

export function clearStreamSession(sessionId: string, turnId: string): void {
  controllers.delete(key(sessionId, turnId));
}

export function cancelAllStreamsForSession(sessionId: string): number {
  let cancelled = 0;
  for (const [id, controller] of controllers) {
    if (!id.startsWith(`${sessionId}:`)) continue;
    controller.abort();
    controllers.delete(id);
    cancelled++;
  }
  return cancelled;
}

export function _resetStreamSessionsForTests(): void {
  for (const c of controllers.values()) c.abort();
  controllers.clear();
}
