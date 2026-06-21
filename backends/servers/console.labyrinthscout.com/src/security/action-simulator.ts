import { evaluatePolicy } from './policy-gateway.js';
import { getShieldMode } from './session-shield.js';
import { getActionRiskScore, resolveActionTypeFromTool } from './risk-registry.js';
import type { PolicyActionType, PolicyDecisionKind } from './policy-decisions.js';

export interface ActionSimulationRequest {
  actionType?: PolicyActionType;
  toolName?: string;
  params?: Record<string, unknown>;
  sessionId: string;
  instanceId?: string;
}

export interface ActionSimulationResult {
  dryRun: true;
  wouldExecute: string;
  wouldTouch: string[];
  policyChecks: Array<{ check: string; result: PolicyDecisionKind; reason: string }>;
  wouldBlock: boolean;
  riskScore: number;
  shieldMode: string;
  preview: string;
}

export async function simulateAction(input: ActionSimulationRequest): Promise<ActionSimulationResult> {
  const actionType = input.actionType
    ?? (input.toolName ? resolveActionTypeFromTool(input.toolName) : 'tool_chain');
  const toolName = input.toolName ?? actionType;

  const decision = await evaluatePolicy({
    actionType,
    sessionId: input.sessionId,
    instanceId: input.instanceId,
    toolName: input.toolName,
    params: input.params,
    confirmed: false,
  });

  const shield = await getShieldMode(input.sessionId);
  const wouldTouch: string[] = [];

  if (actionType === 'shell' && typeof input.params?.command === 'string') {
    wouldTouch.push('filesystem', 'process');
  }
  if (actionType === 'http') {
    const url = typeof input.params?.url === 'string' ? input.params.url : 'unknown destination';
    wouldTouch.push(`network:${url}`);
  }
  if (actionType === 'file_write') {
    const path = typeof input.params?.path === 'string' ? input.params.path : 'unknown path';
    wouldTouch.push(`file:${path}`);
  }
  if (actionType === 'email' || actionType === 'messaging') {
    wouldTouch.push('outbound-message');
  }

  const policyChecks = [{
    check: 'inline_policy_gateway',
    result: decision.decision,
    reason: decision.reason,
  }];

  const wouldBlock = decision.decision === 'block'
    || decision.decision === 'quarantine_session';

  const preview = wouldBlock
    ? `BLOCKED: ${decision.reason}`
    : decision.decision === 'require_approval'
      ? `APPROVAL REQUIRED: ${decision.reason}`
      : decision.decision === 'dry_run'
        ? `DRY RUN ONLY: ${decision.reason}`
        : `Would execute ${toolName}${wouldTouch.length ? ` touching ${wouldTouch.join(', ')}` : ''}`;

  return {
    dryRun: true,
    wouldExecute: toolName,
    wouldTouch,
    policyChecks,
    wouldBlock,
    riskScore: decision.riskScore || getActionRiskScore(actionType, toolName),
    shieldMode: shield.mode,
    preview,
  };
}
