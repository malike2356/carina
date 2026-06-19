import { randomUUID } from 'node:crypto';
import type { ConfirmFn } from '../../agents/tool-runner.js';
import { toolRiskTier, tierMeets, type ToolRiskTier } from '../../security/tool-risk.js';
import { grantApproval } from '../../security/approval-store.js';
import { getActiveProfileName } from '../../profiles/manager.js';
import type { ApprovalRequest } from './types/approval.js';

type Listener = (pending: ApprovalRequest | null) => void;

let pending: ApprovalRequest | null = null;
let resolvePending: ((approved: boolean) => void) | null = null;
const listeners = new Set<Listener>();

let sudoUntil: number | null = null;
let sudoMinTier: ToolRiskTier = 'medium';

export function subscribeApproval(listener: Listener): () => void {
  listeners.add(listener);
  listener(pending);
  return () => listeners.delete(listener);
}

export function getPendingApproval(): ApprovalRequest | null {
  return pending;
}

function notify(next: ApprovalRequest | null): void {
  pending = next;
  for (const listener of listeners) listener(next);
}

export function resolveApproval(approved: boolean): void {
  resolvePending?.(approved);
  resolvePending = null;
  notify(null);
}

export function getSudoState(): { active: boolean; remainingMs: number; minTier: ToolRiskTier } {
  const now = Date.now();
  if (!sudoUntil || now >= sudoUntil) {
    return { active: false, remainingMs: 0, minTier: sudoMinTier };
  }
  return { active: true, remainingMs: sudoUntil - now, minTier: sudoMinTier };
}

export function activateSudoSession(durationMs = 5 * 60 * 1000, minTier: ToolRiskTier = 'medium'): void {
  sudoUntil = Date.now() + durationMs;
  sudoMinTier = minTier;
}

export function deactivateSudoSession(): void {
  sudoUntil = null;
}

export function grantSudoApproval(toolName: string, sessionId: string, durationMs: number): void {
  const profile = process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
  grantApproval({
    tool: toolName,
    scope: 'session',
    scopeId: sessionId,
    ttlMs: durationMs,
    grantedBy: 'ink-sudo',
  });
  grantApproval({
    tool: toolName,
    scope: 'profile',
    scopeId: profile,
    ttlMs: durationMs,
    grantedBy: 'ink-sudo',
  });
}

export function createInkConfirmHandler(_sessionId: string): ConfirmFn {
  return async (toolName, params, reason) => {
    const riskLevel = toolRiskTier(toolName);

    if (riskLevel === 'low') {
      return true;
    }

    const sudo = getSudoState();
    if (sudo.active && tierMeets(sudo.minTier, riskLevel) && riskLevel !== 'critical') {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      resolvePending = resolve;
      notify({
        id: randomUUID(),
        toolName,
        args: params,
        reason,
        riskLevel,
      });
    });
  };
}

export async function registerInkApprovalBridge(sessionId: string): Promise<void> {
  const { getRouter } = await import('../../gateway/router.js');
  getRouter().setConfirmHandler(createInkConfirmHandler(sessionId));
}
