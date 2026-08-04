import { registry } from '../tools/index.js';
import { isToolQuarantined } from '../security/index.js';
import { evaluateApprovalPolicy } from '../security/approval-policy.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { toolRiskTier } from '../security/tool-risk.js';
import { enforceCyberToolTier } from '../tools/tier-check.js';
import { runGovernancePolicyReview } from '../security/governance/index.js';
import type { CapabilityManifest } from './capability-manifest.js';
import { checkTierGate, formatTierGateMessage } from './tier-gates.js';
import { findBestToolMatch } from './manifest-builder.js';

export type GateRejectionCategory =
  | 'not_found'
  | 'credential_missing'
  | 'governance_blocked'
  | 'rate_limited'
  | 'quarantined'
  | 'sandbox_blocked'
  | 'tier_gated';

export type GateRejection = {
  code: string;
  category: GateRejectionCategory;
  details: Record<string, unknown>;
};

export type CapabilityGateResult =
  | { allowed: true }
  | { allowed: false; reason: GateRejection; explanation: string; fix: string };

const sessionToolCounts = new Map<string, { windowStart: number; count: number }>();
const PER_TOOL_PER_MINUTE = Number(process.env.CAPABILITY_GATE_TOOL_RATE_PER_MIN ?? 60);

function rateLimitKey(sessionId: string, toolName: string): string {
  return `${sessionId}:${toolName}`;
}

function checkSessionToolRate(sessionId: string, toolName: string): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const key = rateLimitKey(sessionId, toolName);
  const now = Date.now();
  const row = sessionToolCounts.get(key);
  if (!row || now - row.windowStart > 60_000) {
    sessionToolCounts.set(key, { windowStart: now, count: 1 });
    return { allowed: true };
  }
  row.count += 1;
  if (row.count > PER_TOOL_PER_MINUTE) {
    const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - row.windowStart)) / 1000));
    return { allowed: false, retryAfterSeconds };
  }
  return { allowed: true };
}

export function clearCapabilityGateStateForTests(): void {
  sessionToolCounts.clear();
}

export async function capabilityGate(
  toolName: string,
  toolArgs: Record<string, unknown>,
  manifest: CapabilityManifest,
  sessionId: string,
): Promise<CapabilityGateResult> {
  const tool = registry.get(toolName);
  if (!tool) {
    const suggestion = findBestToolMatch(toolName, manifest);
    if (suggestion) {
      return {
        allowed: false,
        reason: {
          code: 'TOOL_NOT_FOUND',
          category: 'not_found',
          details: { toolName, suggestion: suggestion.name },
        },
        explanation: `I do not have a "${toolName}" capability, but I do have "${suggestion.name}" (${suggestion.description}).`,
        fix: `Try asking me to use "${suggestion.name}" instead.`,
      };
    }
    return {
      allowed: false,
      reason: { code: 'TOOL_NOT_FOUND', category: 'not_found', details: { toolName } },
      explanation: `I do not have a "${toolName}" capability.`,
      fix: 'Describe what you want in plain English and I will find the right tool.',
    };
  }

  const toolEntry = manifest.tools.active.find((row) => row.name === toolName);
  if (!toolEntry) {
    const reason = manifest.tools.inactiveReason[toolName] ?? 'unknown';
    const reasonText =
      reason === 'credential_missing'
        ? `The "${toolName}" tool needs a credential that is not connected.`
        : reason === 'embedding_filtered'
          ? `The "${toolName}" tool is not available in this context.`
          : reason === 'plan_mode_blocked'
            ? `The "${toolName}" tool is not allowed in plan mode.`
            : `The "${toolName}" tool is not available right now.`;
    return {
      allowed: false,
      reason: { code: 'TOOL_INACTIVE', category: 'not_found', details: { toolName, reason } },
      explanation: reasonText,
      fix:
        reason === 'credential_missing'
          ? 'Connect the required credential in Settings, Credentials. It usually takes about a minute.'
          : 'This tool may become available when the context changes.',
    };
  }

  if (toolEntry.credentialRequired && toolEntry.credentialStatus !== 'ready') {
    return {
      allowed: false,
      reason: {
        code: 'CREDENTIAL_MISSING',
        category: 'credential_missing',
        details: { toolName, credential: toolEntry.credentialRequired },
      },
      explanation: `I cannot use "${toolName}" because ${toolEntry.credentialRequired} is not connected yet.`,
      fix: `Connect ${toolEntry.credentialRequired} in Settings, Credentials.`,
    };
  }

  const instanceId =
    process.env.SCOUT_INSTANCE_ID ??
    process.env.LABYRINTH_INSTANCE_ID ??
    'carina-local';
  if (process.env.LABYRINTH_ENABLED === 'true' && isToolQuarantined(instanceId, toolName)) {
    return {
      allowed: false,
      reason: { code: 'TOOL_QUARANTINED', category: 'quarantined', details: { toolName } },
      explanation: `"${toolName}" is temporarily disabled for security review.`,
      fix: 'Your Scout operator can lift the quarantine when review is complete.',
    };
  }

  const tierRequired = checkTierGate(toolName, manifest.platform.tier);
  if (tierRequired) {
    const tierMsg = formatTierGateMessage(toolName, manifest.platform.tier, tierRequired);
    return {
      allowed: false,
      reason: {
        code: 'TIER_GATED',
        category: 'tier_gated',
        details: { toolName, currentTier: manifest.platform.tier, requiredTier: tierRequired },
      },
      explanation: tierMsg.explanation,
      fix: tierMsg.fix,
    };
  }

  const cyberTierBlock = enforceCyberToolTier(toolName);
  if (cyberTierBlock) {
    return {
      allowed: false,
      reason: {
        code: cyberTierBlock.code ?? 'TIER_GATED',
        category: 'tier_gated',
        details: { toolName },
      },
      explanation: cyberTierBlock.error,
      fix: 'Upgrade your workspace tier or connect Scout to unlock this tool.',
    };
  }

  const profile = process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
  const riskTier = toolRiskTier(toolName, tool);
  const skipPolicy = riskTier === 'low' && !tool.dangerous && !tool.requiresConfirmation;
  const policy = skipPolicy
    ? null
    : evaluateApprovalPolicy(toolName, toolArgs, { sessionId, profile }, tool);
  if (policy?.decision === 'block') {
    return {
      allowed: false,
      reason: {
        code: 'GOVERNANCE_BLOCKED',
        category: 'governance_blocked',
        details: { toolName, rules: [policy.code] },
      },
      explanation: `I cannot run "${toolName}" right now because of security policy: ${policy.reason}`,
      fix: 'This action may require approval from your workspace admin in Scout.',
    };
  }

  if (process.env.CARINA_GOVERNANCE_ENABLED !== 'false') {
    const governance = await runGovernancePolicyReview({ action: 'tool_call' });
    if (governance.blocked) {
      return {
        allowed: false,
        reason: {
          code: 'GOVERNANCE_BLOCKED',
          category: 'governance_blocked',
          details: { toolName, rules: governance.evaluations.filter((row) => row.matched && row.enforcement === 'block').map((row) => row.policyId) },
        },
        explanation: `I cannot run "${toolName}" because enterprise governance policy blocks it.`,
        fix: 'Ask your workspace admin to review governance policies in Scout.',
      };
    }
  }

  const rate = checkSessionToolRate(sessionId, toolName);
  if (!rate.allowed) {
    return {
      allowed: false,
      reason: {
        code: 'RATE_LIMITED',
        category: 'rate_limited',
        details: { toolName, retryAfter: rate.retryAfterSeconds },
      },
      explanation: `I have used "${toolName}" too many times recently.`,
      fix: `I can try again in ${rate.retryAfterSeconds} seconds.`,
    };
  }

  if (policy?.decision === 'needs_confirm' && toolArgs._confirmed !== true) {
    return {
      allowed: false,
      reason: {
        code: 'CONFIRMATION_REQUIRED',
        category: 'governance_blocked',
        details: { toolName, message: policy.reason },
      },
      explanation: `"${toolName}" requires confirmation before I can run it. ${policy.reason}`,
      fix: 'Confirm you want me to proceed with this action.',
    };
  }

  return { allowed: true };
}
