import type { Tool } from '../types/index.js';
import { DEFAULT_POLICY } from './tool-policy.js';
import {
  appendApprovalAudit,
  findActiveGrant,
  findAllowRule,
  findBlockingRule,
  grantApproval,
} from './approval-store.js';
import { toolRiskTier, type ToolRiskTier } from './tool-risk.js';

export type ApprovalDecision =
  | { decision: 'allow'; source: 'rule' | 'grant' | 'low_risk' }
  | { decision: 'block'; reason: string; code: 'APPROVAL_BLOCKED' }
  | { decision: 'needs_confirm'; reason: string; riskTier: ToolRiskTier };

export type ApprovalContext = {
  sessionId: string;
  profile: string;
};

export function approvalPolicyEnabled(): boolean {
  return process.env.CARINA_APPROVAL_POLICY !== 'off';
}

function localDangerousCommand(command: string): string | null {
  if (process.env.CARINA_APPROVAL_SHELL_SCAN === 'off') return null;
  for (const re of DEFAULT_POLICY.dangerousCommands) {
    if (re.test(command)) return re.toString();
  }
  return null;
}

export function evaluateApprovalPolicy(
  toolName: string,
  params: Record<string, unknown>,
  context: ApprovalContext,
  tool?: Tool,
): ApprovalDecision | null {
  if (!approvalPolicyEnabled()) return null;

  const riskTier = toolRiskTier(toolName, tool);
  const { profile, sessionId } = context;

  if (toolName === 'shell-exec' && typeof params.command === 'string') {
    const pattern = localDangerousCommand(params.command);
    if (pattern) {
      appendApprovalAudit({
        action: 'shell.blocked',
        tool: toolName,
        scope: 'session',
        scopeId: sessionId,
        detail: pattern,
      });
      return {
        decision: 'block',
        reason: `Command blocked by local approval policy (matched ${pattern})`,
        code: 'APPROVAL_BLOCKED',
      };
    }
  }

  const block = findBlockingRule(toolName, riskTier, profile, sessionId);
  if (block) {
    return {
      decision: 'block',
      reason: `Blocked by approval rule ${block.id}${block.note ? `: ${block.note}` : ''}`,
      code: 'APPROVAL_BLOCKED',
    };
  }

  const allowRule = findAllowRule(toolName, riskTier, profile, sessionId);
  if (allowRule) {
    return { decision: 'allow', source: 'rule' };
  }

  const grant = findActiveGrant(toolName, profile, sessionId, params);
  if (grant) {
    return { decision: 'allow', source: 'grant' };
  }

  if (riskTier === 'low' && process.env.CARINA_APPROVAL_AUTO_LOW === 'true') {
    return { decision: 'allow', source: 'low_risk' };
  }

  return {
    decision: 'needs_confirm',
    reason: `${toolName} (${riskTier} risk) requires operator approval`,
    riskTier,
  };
}

export function rememberApprovalAfterConfirm(
  toolName: string,
  params: Record<string, unknown>,
  context: ApprovalContext,
): void {
  const ttlRaw = process.env.CARINA_APPROVAL_REMEMBER_MS;
  const ttlMs = ttlRaw ? Number(ttlRaw) : 0;
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) return;

  const scope = process.env.CARINA_APPROVAL_REMEMBER_SCOPE === 'session' ? 'session' : 'profile';
  grantApproval({
    tool: toolName,
    scope,
    scopeId: scope === 'session' ? context.sessionId : context.profile,
    ttlMs,
    params: process.env.CARINA_APPROVAL_REMEMBER_PARAMS === 'true' ? params : undefined,
    grantedBy: 'interactive-confirm',
  });
}
