import type { PolicyDecisionKind } from './policy-decisions.js';
import { createPendingApproval } from '../lib/pending-approvals.js';

/**
 * Soft Wall universal contract (AI Security OS prompt 05).
 * Canonical output kinds for Carina tools and Protect containment.
 */
export type SoftWallDecisionKind =
  | 'allow'
  | 'deny'
  | 'require_approval'
  | 'dry_run'
  | 'quarantine';

export type SoftWallRiskTier = 'low' | 'medium' | 'high' | 'critical';

export type SoftWallActionClass =
  | 'tool.call'
  | 'protect.isolate_network'
  | 'protect.revoke_session'
  | 'protect.quarantine_hash'
  | 'protect.block_path'
  | 'protect.disable_maintenance';

export interface SoftWallEvaluateInput {
  actor: string;
  actionClass: SoftWallActionClass;
  targetResource: string;
  riskTier: SoftWallRiskTier;
  tenantId: string;
  policyPack?: string;
  sessionId?: string;
  instanceId?: string;
  breakGlass?: boolean;
  confirmed?: boolean;
  cachedApprovalId?: string;
}

export interface SoftWallEvaluateResult {
  decision: SoftWallDecisionKind;
  reason: string;
  riskTier: SoftWallRiskTier;
  approvalRequestId?: string;
  approvalTtlSeconds?: number;
  auditEventId?: string;
  policyDecisionKind: PolicyDecisionKind;
}

const CRITICAL_PROTECT: SoftWallActionClass[] = [
  'protect.isolate_network',
  'protect.revoke_session',
  'protect.quarantine_hash',
  'protect.block_path',
  'protect.disable_maintenance',
];

/** Map Soft Wall kinds <-> Scout PolicyDecisionKind (deny↔block, quarantine↔quarantine_session). */
export function softWallToPolicyKind(decision: SoftWallDecisionKind): PolicyDecisionKind {
  switch (decision) {
    case 'deny':
      return 'block';
    case 'quarantine':
      return 'quarantine_session';
    default:
      return decision;
  }
}

export function policyKindToSoftWall(decision: PolicyDecisionKind): SoftWallDecisionKind {
  switch (decision) {
    case 'block':
      return 'deny';
    case 'quarantine_session':
      return 'quarantine';
    default:
      return decision;
  }
}

export function normalizeSoftWallDecision(raw: string): SoftWallDecisionKind | null {
  const v = raw.trim().toLowerCase();
  if (v === 'block' || v === 'deny') return 'deny';
  if (v === 'quarantine_session' || v === 'quarantine') return 'quarantine';
  if (v === 'allow' || v === 'require_approval' || v === 'dry_run') return v;
  return null;
}

/**
 * Evaluate Soft Wall for Protect containment and high-risk fleet actions.
 * CRITICAL always require_approval unless break-glass (audited) or prior confirmed approval.
 */
export async function evaluateSoftWall(input: SoftWallEvaluateInput): Promise<SoftWallEvaluateResult> {
  const isCriticalProtect =
    input.riskTier === 'critical' || CRITICAL_PROTECT.includes(input.actionClass);

  if (input.breakGlass === true && isCriticalProtect) {
    return {
      decision: 'allow',
      reason: 'Break-glass override; audited allow for CRITICAL Protect action',
      riskTier: input.riskTier,
      auditEventId: `breakglass:${input.tenantId}:${Date.now()}`,
      policyDecisionKind: 'allow',
    };
  }

  if (isCriticalProtect && input.confirmed !== true && !input.cachedApprovalId) {
    const approval = await createPendingApproval({
      instanceId: input.instanceId ?? `protect:${input.tenantId}`,
      sessionId: input.sessionId ?? `protect:${input.actor}`,
      toolName: input.actionClass,
      actionType: input.actionClass,
      content: input.targetResource,
      params: {
        actor: input.actor,
        actionClass: input.actionClass,
        targetResource: input.targetResource,
        riskTier: input.riskTier,
        policyPack: input.policyPack ?? null,
      },
      riskScore: 95,
      policyPack: input.policyPack,
      expiresInSecs: 900,
    });

    return {
      decision: 'require_approval',
      reason: 'CRITICAL Protect action requires Soft Wall approval',
      riskTier: input.riskTier,
      approvalRequestId: approval.id,
      approvalTtlSeconds: 900,
      auditEventId: `softwall:approval:${approval.id}`,
      policyDecisionKind: 'require_approval',
    };
  }

  if (input.riskTier === 'high' && input.actionClass.startsWith('protect.') && input.confirmed !== true) {
    return {
      decision: 'require_approval',
      reason: 'High-risk Protect action requires Soft Wall approval',
      riskTier: input.riskTier,
      policyDecisionKind: 'require_approval',
    };
  }

  return {
    decision: 'allow',
    reason: 'Soft Wall allow',
    riskTier: input.riskTier,
    approvalRequestId: input.cachedApprovalId,
    auditEventId: `softwall:allow:${input.tenantId}:${Date.now()}`,
    policyDecisionKind: 'allow',
  };
}
