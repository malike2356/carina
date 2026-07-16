import type { OrgRole } from '../hosted/org-types.js';
import { isAdminRole } from './admin-tool-policy.js';

const sessionPlanMode = new Map<string, boolean>();
let globalPlanMode = false;

export function setSessionPlanMode(sessionId: string, enabled: boolean): void {
  if (!sessionId.trim()) return;
  if (enabled) {
    sessionPlanMode.set(sessionId, true);
  } else {
    sessionPlanMode.delete(sessionId);
  }
}

export function isSessionPlanMode(sessionId: string): boolean {
  return sessionPlanMode.get(sessionId) === true;
}

export function clearSessionPlanMode(sessionId: string): void {
  sessionPlanMode.delete(sessionId);
}

export function setGlobalPlanMode(enabled: boolean): void {
  globalPlanMode = enabled;
}

export function isGlobalPlanMode(): boolean {
  return globalPlanMode;
}

export function resolvePlanMode(opts: {
  sessionId?: string;
  orgRole?: OrgRole;
  contextPlanMode?: boolean;
}): boolean {
  if (opts.contextPlanMode) return true;
  if (opts.sessionId && isSessionPlanMode(opts.sessionId)) return true;
  if (isGlobalPlanMode()) return true;
  if (opts.orgRole && !isAdminRole(opts.orgRole)) return true;
  return false;
}

export function resetPlanModeStateForTests(): void {
  sessionPlanMode.clear();
  globalPlanMode = false;
}
