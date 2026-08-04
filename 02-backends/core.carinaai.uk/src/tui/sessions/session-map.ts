import type { SessionInfo } from '../runtime-transport/types.js';

export type SessionStatus = 'active' | 'available' | 'stale' | 'missing';

export interface SessionMapNode extends SessionInfo {
  parentSessionId?: string;
  branchName?: string;
  forkedFrom?: string;
  createdAt?: string;
  status: SessionStatus;
}

export function buildSessionMap(sessions: SessionInfo[], currentSessionId?: string): SessionMapNode[] {
  return sessions.map((session) => ({
    ...session,
    status: session.id === currentSessionId ? 'active' : resolveSessionStatus(session),
  }));
}

export function searchSessionMap(nodes: SessionMapNode[], query: string): SessionMapNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.filter((node) => [
    node.id,
    node.name,
    node.model,
    node.lastPreview,
    node.updatedAt,
    node.branchName,
  ].some((value) => fuzzyMatch(q, value ?? '')));
}

export function currentSessionPath(nodes: SessionMapNode[], currentSessionId: string): SessionMapNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const path: SessionMapNode[] = [];
  let cursor = byId.get(currentSessionId);
  while (cursor) {
    path.unshift(cursor);
    cursor = cursor.parentSessionId ? byId.get(cursor.parentSessionId) : undefined;
  }
  return path;
}

export function cycleSession(nodes: SessionMapNode[], currentSessionId: string | undefined, direction: -1 | 1): SessionMapNode | undefined {
  if (nodes.length === 0) return undefined;
  const currentIndex = nodes.findIndex((node) => node.id === currentSessionId);
  const base = currentIndex >= 0 ? currentIndex : 0;
  return nodes[(base + direction + nodes.length) % nodes.length];
}

export function forkSessionFallback(current: SessionInfo, nextId: string): SessionMapNode {
  return {
    ...current,
    id: nextId,
    name: `${current.name} fork`,
    parentSessionId: current.id,
    forkedFrom: current.id,
    branchName: 'fork',
    messageCount: current.messageCount,
    tokenCount: current.tokenCount,
    status: 'active',
  };
}

export function renameSessionLocal(session: SessionMapNode, title: string): SessionMapNode {
  return {
    ...session,
    name: title.trim() || session.name,
  };
}

export function renderSessionMap(nodes: SessionMapNode[], width: number): string[] {
  const compact = width < 72;
  return nodes.map((node) => {
    const marker = node.status === 'active' ? '>' : ' ';
    const branch = node.parentSessionId ? ` <- ${node.parentSessionId.slice(0, 6)}` : '';
    const meta = compact
      ? `${node.messageCount} msgs`
      : `${node.model} | ${node.messageCount} msgs | ${node.tokenCount} tok${branch}`;
    const line = `${marker} ${node.name} | ${meta}`;
    return line.length > width ? `${line.slice(0, Math.max(0, width - 3))}...` : line;
  });
}

function resolveSessionStatus(session: SessionInfo): SessionStatus {
  if (!session.updatedAt) return 'available';
  const updated = Date.parse(session.updatedAt);
  if (Number.isNaN(updated)) return 'available';
  return Date.now() - updated > 1000 * 60 * 60 * 24 * 14 ? 'stale' : 'available';
}

function fuzzyMatch(query: string, target: string): boolean {
  const t = target.toLowerCase();
  let qi = 0;
  for (let ti = 0; ti < t.length && qi < query.length; ti++) {
    if (t[ti] === query[qi]) qi++;
  }
  return qi === query.length;
}
