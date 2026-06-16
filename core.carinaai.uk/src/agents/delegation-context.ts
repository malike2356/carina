export const MAX_CONCURRENT_SUBAGENTS = 3;

export type SubagentRole = 'leaf' | 'orchestrator';

const depthBySession = new Map<string, number>();
const roleBySession = new Map<string, SubagentRole>();
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
}

export function setSubagentRole(sessionId: string, role: SubagentRole): void {
  roleBySession.set(sessionId, role);
}

export function getSubagentRole(sessionId: string): SubagentRole {
  return roleBySession.get(sessionId) ?? 'leaf';
}

export function getMaxDelegationDepth(): number {
  const raw = process.env.CARINA_MAX_DELEGATION_DEPTH;
  if (!raw) return 1;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
}

/** @deprecated use getMaxDelegationDepth() */
export const MAX_DELEGATION_DEPTH = 1;

export function canDelegate(sessionId: string): boolean {
  const depth = getDelegationDepth(sessionId);
  if (depth >= getMaxDelegationDepth()) return false;
  if (isSubagentSession(sessionId) && getSubagentRole(sessionId) !== 'orchestrator') {
    return false;
  }
  return true;
}

export function beginParentTurn(sessionId: string): AbortController {
  if (isSubagentSession(sessionId)) {
    return new AbortController();
  }
  endParentTurn(sessionId);
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
  const idx = sessionId.indexOf(':sub:');
  return idx === -1 ? sessionId : sessionId.slice(0, idx);
}

export function resetDelegationState(): void {
  depthBySession.clear();
  roleBySession.clear();
  for (const controller of parentControllers.values()) {
    if (!controller.signal.aborted) controller.abort();
  }
  parentControllers.clear();
  childControllers.clear();
}
