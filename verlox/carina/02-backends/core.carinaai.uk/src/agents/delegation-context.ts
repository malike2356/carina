import type { AgentSpawnContext } from './agent-roles.js';
import { MAX_SPAWN_DEPTH } from './agent-roles.js';

export const MAX_CONCURRENT_SUBAGENTS = 3;

export type SubagentRole = 'leaf' | 'orchestrator';

const depthBySession = new Map<string, number>();
const roleBySession = new Map<string, SubagentRole>();
const spawnContextBySession = new Map<string, AgentSpawnContext>();
const parentControllers = new Map<string, AbortController>();
const childControllers = new Map<string, Set<AbortController>>();

export function isSubagentSession(sessionId: string): boolean {
  return sessionId.includes(':sub:');
}

export function getDelegationDepth(sessionId: string): number {
  return depthBySession.get(sessionId) ?? 0;
}

export function setDelegationDepth(sessionId: string, depth: number): void {
  depthBySession.set(sessionId, depth);
}

export function clearDelegationDepth(sessionId: string): void {
  depthBySession.delete(sessionId);
  roleBySession.delete(sessionId);
  spawnContextBySession.delete(sessionId);
}

export function setSpawnContext(sessionId: string, context: AgentSpawnContext): void {
  spawnContextBySession.set(sessionId, context);
  setDelegationDepth(sessionId, context.depth);
  if (context.role === 'leaf' || context.role === 'orchestrator') {
    setSubagentRole(sessionId, context.role);
  }
}

export function getSpawnContext(sessionId: string): AgentSpawnContext {
  const stored = spawnContextBySession.get(sessionId);
  const depth = getDelegationDepth(sessionId);
  const max = getMaxDelegationDepth();
  if (stored) {
    return {
      ...stored,
      depth,
      role: depth >= max ? 'leaf' : stored.role,
    };
  }
  const role: AgentSpawnContext['role'] = isWorkerSession(sessionId)
    ? getSubagentRole(sessionId)
    : 'orchestrator';
  return {
    depth,
    parentAgentId: parentSessionId(sessionId),
    role: depth >= max ? 'leaf' : role,
  };
}

export function getActiveChildCount(sessionId: string): number {
  const root = rootSessionId(sessionId);
  return childControllers.get(root)?.size ?? 0;
}

export function isWorkerSession(sessionId: string): boolean {
  return sessionId.includes(':sub:') || sessionId.includes(':kanban:');
}

export function setSubagentRole(sessionId: string, role: SubagentRole): void {
  roleBySession.set(sessionId, role);
}

export function getSubagentRole(sessionId: string): SubagentRole {
  return roleBySession.get(sessionId) ?? 'leaf';
}

export function getMaxDelegationDepth(): number {
  const raw = process.env.CARINA_MAX_DELEGATION_DEPTH;
  if (!raw) return MAX_SPAWN_DEPTH;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : MAX_SPAWN_DEPTH;
}

/** @deprecated use getMaxDelegationDepth() */
export const MAX_DELEGATION_DEPTH = MAX_SPAWN_DEPTH;

export function canDelegate(sessionId: string): boolean {
  const depth = getDelegationDepth(sessionId);
  if (depth >= getMaxDelegationDepth()) return false;
  if (isWorkerSession(sessionId) && getSubagentRole(sessionId) !== 'orchestrator') {
    return false;
  }
  return true;
}

export function beginParentTurn(sessionId: string): AbortController {
  if (isWorkerSession(sessionId)) {
    return new AbortController();
  }
  endParentTurn(sessionId);
  setSpawnContext(sessionId, {
    depth: 0,
    parentAgentId: null,
    role: 'orchestrator',
  });
  const controller = new AbortController();
  parentControllers.set(sessionId, controller);
  childControllers.set(sessionId, new Set());
  return controller;
}

export function getParentAbortSignal(sessionId: string): AbortSignal | undefined {
  const root = rootSessionId(sessionId);
  return parentControllers.get(root)?.signal;
}

export function endParentTurn(sessionId: string): void {
  const root = rootSessionId(sessionId);
  const children = childControllers.get(root);
  if (children) {
    for (const child of children) {
      if (!child.signal.aborted) child.abort();
    }
    childControllers.delete(root);
  }
  const parent = parentControllers.get(root);
  if (parent && !parent.signal.aborted) parent.abort();
  parentControllers.delete(root);
}

export function createChildAbortController(parentSessionId: string): AbortController {
  const root = rootSessionId(parentSessionId);
  const child = new AbortController();
  const parent = parentControllers.get(root);
  if (parent) {
    if (parent.signal.aborted) {
      child.abort();
    } else {
      parent.signal.addEventListener('abort', () => child.abort(), { once: true });
    }
  }
  let set = childControllers.get(root);
  if (!set) {
    set = new Set();
    childControllers.set(root, set);
  }
  set.add(child);
  return child;
}

export function releaseChildAbortController(
  parentSessionId: string,
  child: AbortController,
): void {
  const root = rootSessionId(parentSessionId);
  childControllers.get(root)?.delete(child);
}

function rootSessionId(sessionId: string): string {
  const subIdx = sessionId.indexOf(':sub:');
  if (subIdx !== -1) return sessionId.slice(0, subIdx);
  const kanbanIdx = sessionId.indexOf(':kanban:');
  if (kanbanIdx !== -1) return sessionId.slice(0, kanbanIdx);
  return sessionId;
}

function parentSessionId(sessionId: string): string | null {
  const subIdx = sessionId.indexOf(':sub:');
  if (subIdx !== -1) return sessionId.slice(0, subIdx);
  const kanbanIdx = sessionId.indexOf(':kanban:');
  if (kanbanIdx !== -1) return sessionId.slice(0, kanbanIdx);
  return null;
}

export function resetDelegationState(): void {
  depthBySession.clear();
  roleBySession.clear();
  spawnContextBySession.clear();
  for (const controller of parentControllers.values()) {
    if (!controller.signal.aborted) controller.abort();
  }
  parentControllers.clear();
  childControllers.clear();
}
