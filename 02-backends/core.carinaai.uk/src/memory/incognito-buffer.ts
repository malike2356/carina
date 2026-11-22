import type { Memory, Role } from '../../types/index.js';

type BufferTurn = {
  id: string;
  sessionId: string;
  role: Role;
  content: string;
  createdAt: Date;
};

const sessionFlags = new Map<string, boolean>();
const buffers = new Map<string, BufferTurn[]>();
const MAX_TURNS = 80;

export function markIncognitoSession(sessionId: string, enabled: boolean): void {
  if (enabled) {
    sessionFlags.set(sessionId, true);
    return;
  }
  sessionFlags.delete(sessionId);
  buffers.delete(sessionId);
}

export function isIncognitoSessionMarked(sessionId: string): boolean {
  return sessionFlags.get(sessionId) === true;
}

export function clearIncognitoBuffer(sessionId: string): void {
  buffers.delete(sessionId);
}

export function appendIncognitoTurn(
  sessionId: string,
  role: Role,
  content: string,
): void {
  const list = buffers.get(sessionId) ?? [];
  list.push({
    id: `incog-${Date.now()}-${list.length}`,
    sessionId,
    role,
    content,
    createdAt: new Date(),
  });
  while (list.length > MAX_TURNS) list.shift();
  buffers.set(sessionId, list);
}

export function getIncognitoHistory(sessionId: string, limit: number): Memory[] {
  const list = buffers.get(sessionId) ?? [];
  return list.slice(-Math.max(1, limit)).map((turn) => ({
    id: turn.id,
    sessionId: turn.sessionId,
    role: turn.role,
    content: turn.content,
    createdAt: turn.createdAt,
  }));
}
