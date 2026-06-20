import type { Request } from 'express';
import {
  DangerousCommandError,
  ConfirmationRequiredError,
  ToolBlockedError,
  getLoadedPolicy,
} from './tool-policy.js';
import { canonicalToolName } from './tool-tiers.js';
import { egressFilter } from './egress-filter.js';
import type {
  PolicyDecision,
  PolicyDecisionKind,
  PolicyEvaluateRequest,
  ShieldMode,
} from './policy-decisions.js';
import {
  buildRiskEntry,
  getActionRiskScore,
  isHighRiskTool,
  resolveActionTypeFromTool,
} from './risk-registry.js';
import {
  getShieldMode,
  isToolAllowedInShieldMode,
  requiresApprovalInGuardMode,
} from './session-shield.js';
import { inspectContext, inspectOutput } from './context-firewall.js';
import type { ContextSourceType } from './policy-decisions.js';
import { hasValidJitGrant } from './jit-privileges.js';
import {
  isSurfaceRestricted,
  restrictionBlocksTool,
} from './attack-surface.js';

export interface PolicyGatewayDeps {
  logDecision: (
    req: Request | undefined,
    decision: PolicyDecision,
    meta: Record<string, unknown>,
  ) => Promise<void>;
  isSessionBlocked: (sessionId: string) => Promise<boolean>;
  isToolQuarantined: (instanceId: string, toolName: string) => Promise<boolean>;
}

async function defaultLogDecision(
  req: Request | undefined,
  decision: PolicyDecision,
  meta: Record<string, unknown>,
): Promise<void> {
  void req;
  void decision;
  void meta;
}

async function defaultIsSessionBlocked(_sessionId: string): Promise<boolean> {
  return false;
}

async function defaultIsToolQuarantined(_instanceId: string, _toolName: string): Promise<boolean> {
  return false;
}

let deps: PolicyGatewayDeps = {
  logDecision: defaultLogDecision,
  isSessionBlocked: defaultIsSessionBlocked,
  isToolQuarantined: defaultIsToolQuarantined,
};

export function setPolicyGatewayDeps(overrides: Partial<PolicyGatewayDeps>): void {
  deps = { ...deps, ...overrides };
}

export function resetPolicyGatewayDeps(): void {
  deps = {
    logDecision: defaultLogDecision,
    isSessionBlocked: defaultIsSessionBlocked,
    isToolQuarantined: defaultIsToolQuarantined,
  };
}

function applyShieldModeDecision(
  baseDecision: PolicyDecisionKind,
  shieldMode: ShieldMode,
  riskScore: number,
  confirmed: boolean,
): PolicyDecisionKind {
  if (baseDecision === 'block' || baseDecision === 'quarantine_session') {
    return baseDecision;
  }

  if (shieldMode === 'quarantine') {
    return 'quarantine_session';
  }

  if (shieldMode === 'restrict' && riskScore >= 65) {
    return 'block';
  }

  if (shieldMode === 'guard' && riskScore >= 70 && !confirmed) {
    return 'require_approval';
  }

  return baseDecision;
}

function checkDangerousCommand(command: string): { blocked: boolean; pattern?: string } {
  const policy = getLoadedPolicy();
  const matched = policy.dangerousCommands.find((re) => re.test(command));
  if (matched) return { blocked: true, pattern: matched.source };
  return { blocked: false };
}

function checkHttpDestination(url: string): { blocked: boolean; reason?: string } {
  if (!egressFilter.isAllowed(url)) {
    return { blocked: true, reason: 'destination not in egress allowlist' };
  }
  return { blocked: false };
}

function checkToolPolicy(toolName: string, confirmed: boolean): PolicyDecisionKind {
  const policy = getLoadedPolicy();
  const canonical = canonicalToolName(toolName);

  if (policy.blocklist.includes(toolName) || policy.blocklist.includes(canonical)) {
    return 'block';
  }

  if (policy.requireConfirmList.includes(toolName) && !confirmed) {
    return 'require_approval';
  }

  if (policy.requireConfirmList.includes(canonical) && !confirmed) {
    return 'require_approval';
  }

  return 'allow';
}

export async function evaluatePolicy(
  request: PolicyEvaluateRequest,
  req?: Request,
): Promise<PolicyDecision> {
  const sessionId = request.sessionId;
  const instanceId = request.instanceId ?? 'unknown';
  const actionType = request.actionType
    ?? (request.toolName ? resolveActionTypeFromTool(request.toolName) : 'tool_chain');
  const toolName = request.toolName ?? '';
  const confirmed = request.confirmed === true;

  const shieldState = await getShieldMode(sessionId);
  const shieldMode = shieldState.mode;
  const riskEntry = buildRiskEntry(actionType, toolName || undefined);
  let riskScore = riskEntry.baseScore;
  let reason = riskEntry.description;
  let decision: PolicyDecisionKind = 'allow';

  if (await deps.isSessionBlocked(sessionId)) {
    return finalizeDecision(req, {
      decision: 'quarantine_session',
      actionType,
      reason: 'session is blocked',
      riskScore: 100,
      shieldMode,
    }, { sessionId, instanceId, toolName });
  }

  if (shieldMode === 'quarantine') {
    return finalizeDecision(req, {
      decision: 'quarantine_session',
      actionType,
      reason: 'session is in quarantine mode',
      riskScore: 100,
      shieldMode,
    }, { sessionId, instanceId, toolName });
  }

  if (toolName) {
    if (await deps.isToolQuarantined(instanceId, toolName)) {
      return finalizeDecision(req, {
        decision: 'block',
        actionType,
        reason: `tool '${toolName}' is quarantined`,
        riskScore: 95,
        shieldMode,
      }, { sessionId, instanceId, toolName });
    }

    const shellRestriction = await isSurfaceRestricted(instanceId, 'shell', sessionId);
    if (shellRestriction && restrictionBlocksTool('shell', toolName)) {
      return finalizeDecision(req, {
        decision: 'block',
        actionType,
        reason: `shell disabled: ${shellRestriction.reason}`,
        riskScore: 90,
        shieldMode,
      }, { sessionId, instanceId, toolName });
    }

    const httpRestriction = await isSurfaceRestricted(instanceId, 'external_http', sessionId);
    if (httpRestriction && restrictionBlocksTool('external_http', toolName)) {
      return finalizeDecision(req, {
        decision: 'block',
        actionType,
        reason: `external HTTP disabled: ${httpRestriction.reason}`,
        riskScore: 85,
        shieldMode,
      }, { sessionId, instanceId, toolName });
    }

    const toolCheck = await isToolAllowedInShieldMode(toolName, shieldMode);
    if (!toolCheck.allowed) {
      return finalizeDecision(req, {
        decision: 'block',
        actionType,
        reason: toolCheck.reason ?? 'tool not allowed in current shield mode',
        riskScore: 90,
        shieldMode,
      }, { sessionId, instanceId, toolName });
    }

    if (requiresApprovalInGuardMode(toolName, shieldMode) && !confirmed) {
      decision = 'require_approval';
      reason = `tool '${toolName}' requires approval in guard mode`;
    } else {
      decision = checkToolPolicy(toolName, confirmed);
      if (decision !== 'allow') {
        reason = decision === 'require_approval'
          ? `tool '${toolName}' requires confirmation`
          : `tool '${toolName}' is blocked by policy`;
      }
    }
  }

  if (decision === 'allow' && actionType === 'shell' && typeof request.params?.command === 'string') {
    const cmdCheck = checkDangerousCommand(request.params.command as string);
    if (cmdCheck.blocked) {
      decision = 'block';
      reason = `dangerous command pattern: ${cmdCheck.pattern}`;
      riskScore = 95;
    }
  }

  if (decision === 'allow' && actionType === 'http') {
    const url = typeof request.params?.url === 'string'
      ? request.params.url
      : typeof request.params?.destination === 'string'
        ? request.params.destination
        : '';
    if (url) {
      const httpCheck = checkHttpDestination(url);
      if (httpCheck.blocked) {
        decision = 'block';
        reason = httpCheck.reason ?? 'egress blocked';
        riskScore = 80;
      }
    }
  }

  if (decision === 'allow' && isHighRiskTool(toolName) && shieldMode === 'guard' && !confirmed) {
    const jitGrant = await hasValidJitGrant(sessionId, toolName, actionType);
    if (!jitGrant) {
      decision = 'require_approval';
      reason = `high-risk tool '${toolName}' requires approval or JIT grant`;
    }
  }

  if (decision === 'require_approval' && confirmed) {
    const jitGrant = await hasValidJitGrant(sessionId, toolName, actionType);
    if (jitGrant) {
      decision = 'allow';
      reason = `JIT grant ${jitGrant.id} covers this action`;
    }
  }

  decision = applyShieldModeDecision(decision, shieldMode, riskScore, confirmed);

  return finalizeDecision(req, {
    decision,
    actionType,
    reason,
    riskScore,
    shieldMode,
    metadata: { toolName, confirmed },
  }, { sessionId, instanceId, toolName });
}

async function finalizeDecision(
  req: Request | undefined,
  partial: Omit<PolicyDecision, 'metadata'> & { metadata?: Record<string, unknown> },
  audit: Record<string, unknown>,
): Promise<PolicyDecision> {
  const decision: PolicyDecision = {
    decision: partial.decision,
    actionType: partial.actionType,
    reason: partial.reason,
    riskScore: partial.riskScore,
    shieldMode: partial.shieldMode,
    metadata: partial.metadata,
  };

  await deps.logDecision(req, decision, audit).catch(() => undefined);
  return decision;
}

export async function evaluateContext(
  content: string,
  contextType: ContextSourceType,
  sessionId: string,
  req?: Request,
  toolName?: string,
): Promise<PolicyDecision> {
  const shieldState = await getShieldMode(sessionId);
  const firewall = await inspectContext(content, contextType, shieldState.mode, toolName);

  let decision: PolicyDecisionKind = 'allow';
  if (firewall.action === 'block') decision = 'block';
  else if (firewall.action === 'isolate') decision = 'quarantine_session';

  const result: PolicyDecision = {
    decision,
    actionType: 'tool_chain',
    reason: firewall.reason,
    riskScore: firewall.riskScore,
    shieldMode: shieldState.mode,
    filteredContent: firewall.content,
    metadata: {
      contextType,
      firewallAction: firewall.action,
      patterns: firewall.patterns,
    },
  };

  await deps.logDecision(req, result, { sessionId, contextType, toolName }).catch(() => undefined);
  return result;
}

export async function evaluateOutputProtection(
  content: string,
  sessionId: string,
  req?: Request,
  toolName?: string,
): Promise<PolicyDecision> {
  const shieldState = await getShieldMode(sessionId);
  const firewall = await inspectOutput(content, toolName, shieldState.mode);

  let decision: PolicyDecisionKind = 'allow';
  if (firewall.action === 'block') decision = 'block';

  const result: PolicyDecision = {
    decision,
    actionType: 'tool_chain',
    reason: firewall.reason,
    riskScore: firewall.riskScore,
    shieldMode: shieldState.mode,
    filteredContent: firewall.content,
    metadata: {
      outputProtection: true,
      firewallAction: firewall.action,
      patterns: firewall.patterns,
    },
  };

  await deps.logDecision(req, result, { sessionId, toolName }).catch(() => undefined);
  return result;
}

export {
  ToolBlockedError,
  DangerousCommandError,
  ConfirmationRequiredError,
  getActionRiskScore,
};
