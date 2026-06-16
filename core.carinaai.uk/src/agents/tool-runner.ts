import type { Tool, ToolCall } from '../types/index.js';
import { registry, getSessionTool } from '../tools/index.js';
import { getToolCacheTtlSeconds, withCache } from '../tools/cache.js';
import { checkNotSuspended, reportToolCall, isToolQuarantined } from '../security/index.js';
import { scanToolOutput } from '../security/prompt-guard-middleware.js';
import { enforceToolPolicy } from '../security/tool-policy-middleware.js';
import { enforceToolSequence, recordToolSequenceStep } from '../security/tool-sequence-middleware.js';
import {
  enforceJitCredentials,
  finalizeJitCredentials,
  grantJitCredentialsAfterConfirm,
} from '../security/jit-credentials-middleware.js';
import { getJitCredentialStore, requiresJitGrant } from '../security/jit-credentials.js';
import {
  evaluateApprovalPolicy,
  rememberApprovalAfterConfirm,
} from '../security/approval-policy.js';
import { getToolExecutionContext } from '../security/tool-execution-context.js';
import { isSubagentSession } from './delegation-context.js';
import { isSubagentBlockedTool } from './subagent-policy.js';
import { evaluateToolRbac } from '../security/tool-rbac.js';
import { resolveSandboxExecution } from '../security/sandbox-policy.js';
import { appendSecurityAudit } from '../security/security-audit.js';
import { evaluateScoutToolPolicy, reportPolicyFallback } from '../security/scout-policy-client.js';
import { toolRiskTier } from '../security/tool-risk.js';
import { getActiveProfileName } from '../profiles/manager.js';
import { getActiveAgentDefinition } from '../workspaces/agent-registry.js';
import { isToolAllowed, recordToolPolicyCall } from './tool-operator-policy.js';

export type ConfirmFn = (
  toolName: string,
  params: Record<string, unknown>,
  reason: string,
) => Promise<boolean>;

async function needsUserConfirmation(
  tool: Tool,
  params: Record<string, unknown>,
): Promise<boolean> {
  if (tool.dangerous) return true;
  if (tool.needsConfirmation) {
    const result = await tool.needsConfirmation(params);
    if (result) return true;
  }
  if (tool.requiresConfirmation) return true;
  return false;
}

export async function executeToolCall(
  call: ToolCall,
  confirm?: ConfirmFn,
  alwaysConfirm = false,
  sessionId = 'default-session',
): Promise<unknown> {
  if (process.env.LABYRINTH_ENABLED === 'true') {
    checkNotSuspended();
    const instanceId =
      process.env.SCOUT_INSTANCE_ID ??
      process.env.LABYRINTH_INSTANCE_ID ??
      'carina-local';
    if (isToolQuarantined(instanceId, call.toolName)) {
      return {
        error: `Tool "${call.toolName}" is temporarily quarantined by security policy. Try again later or contact your administrator.`,
      };
    }
  }
  const startTime = Date.now();

  const tool = getSessionTool(sessionId, call.toolName) ?? registry.get(call.toolName);
  if (!tool) {
    return { error: `Unknown tool: ${call.toolName}` };
  }

  if (isSubagentSession(sessionId)) {
    if (isSubagentBlockedTool(call.toolName)) {
      return {
        error: `Tool "${call.toolName}" is blocked for subagents.`,
        code: 'SUBAGENT_TOOL_BLOCKED',
      };
    }
    if (!confirm && (tool.dangerous || tool.requiresConfirmation)) {
      return {
        error: `Subagents cannot run "${call.toolName}" without interactive approval.`,
        code: 'SUBAGENT_CONFIRM_BLOCKED',
      };
    }
  }

  const workspaceId = String(call.params._workspaceId ?? call.params.workspaceId ?? sessionId);
  const operatorPolicy = await isToolAllowed(call.toolName, workspaceId);
  if (!operatorPolicy.allowed) {
    return {
      error: 'Tool disabled by operator',
      code: 'OPERATOR_TOOL_DISABLED',
      category: operatorPolicy.category,
    };
  }
  const messageKey = String(call.params._messageId ?? call.params._turnId ?? sessionId);
  const policyCount = recordToolPolicyCall(
    workspaceId,
    operatorPolicy.category,
    messageKey,
    operatorPolicy.maxCalls,
  );
  if (!policyCount.allowed) {
    return {
      error: `Tool category "${operatorPolicy.category}" exceeded operator max calls (${operatorPolicy.maxCalls}) for this message.`,
      code: 'OPERATOR_TOOL_LIMIT_EXCEEDED',
      category: operatorPolicy.category,
      maxCalls: operatorPolicy.maxCalls,
    };
  }

  const rbac = evaluateToolRbac(call.toolName, getToolExecutionContext().orgRole, tool);
  if (!rbac.allowed) {
    appendSecurityAudit({
      category: 'tool_rbac',
      action: 'deny',
      detail: rbac.reason ?? 'Role denied',
      sessionId,
      toolName: call.toolName,
      metadata: { role: rbac.role, requiredRole: rbac.requiredRole, riskTier: rbac.riskTier },
    });
    return {
      error: rbac.reason ?? 'Tool access denied by role policy.',
      code: 'TOOL_RBAC_DENIED',
      requiredRole: rbac.requiredRole,
    };
  }

  const activeAgent = getActiveAgentDefinition();
  const sandboxResolution = resolveSandboxExecution(sessionId, call.toolName, activeAgent.id);
  if (sandboxResolution.mode === 'blocked') {
    appendSecurityAudit({
      category: 'sandbox_policy',
      action: 'block',
      detail: sandboxResolution.reason,
      sessionId,
      toolName: call.toolName,
      metadata: { policyMode: sandboxResolution.policyMode },
    });
    return { error: sandboxResolution.reason, code: 'SANDBOX_POLICY_BLOCKED' };
  }

  if (tool.dangerous) {
    console.warn(`[dangerous tool] ${call.toolName}`);
  }

  const profile = process.env.CARINA_PROFILE ?? getActiveProfileName() ?? 'default';
  const approvalContext = { sessionId, profile };
  const riskTier = toolRiskTier(call.toolName, tool);
  const skipPolicy = riskTier === 'low' && !tool.dangerous && !tool.requiresConfirmation;
  const policy = skipPolicy
    ? null
    : evaluateApprovalPolicy(call.toolName, call.params, approvalContext, tool);

  if (policy?.decision === 'block') {
    return { error: policy.reason, code: policy.code };
  }

  const needsJitApproval = requiresJitGrant(call.toolName)
    && !getJitCredentialStore().hasValidGrant(sessionId, call.toolName, call.params)
    && call.params._jit_granted !== true;

  const policyAllows = policy?.decision === 'allow';
  const mustConfirm =
    !policyAllows
    && (
      alwaysConfirm ||
      needsJitApproval ||
      operatorPolicy.requiresApproval ||
      (await needsUserConfirmation(tool, call.params))
    );
  if (mustConfirm) {
    if (!confirm) {
      return { error: 'Tool requires confirmation but no confirm handler is configured.' };
    }
    const reason = policy?.decision === 'needs_confirm'
      ? policy.reason
      : operatorPolicy.requiresApproval
        ? 'Operator policy requires approval before running this tool.'
        : tool.dangerous
        ? 'This tool is marked dangerous.'
        : 'Confirmation required before running.';
    const ok = await confirm(call.toolName, call.params, reason);
    if (!ok) {
      return { error: 'User declined tool execution.' };
    }
    call.params = { ...call.params, _confirmed: true };
    grantJitCredentialsAfterConfirm(sessionId, call.toolName, call.params);
    rememberApprovalAfterConfirm(call.toolName, call.params, approvalContext);
  }

  const sequenceError = await enforceToolSequence(sessionId, call.toolName, call.params);
  if (sequenceError) return sequenceError;

  const jitError = enforceJitCredentials(sessionId, call.toolName, call.params);
  if (jitError) return jitError;

  if (process.env.LABYRINTH_ENABLED === 'true') {
    const scoutPolicy = await evaluateScoutToolPolicy(call.toolName, call.params, sessionId);
    if (scoutPolicy.enforced && scoutPolicy.code) {
      if (scoutPolicy.decision === 'require_approval') {
        if (!confirm) {
          return {
            error: scoutPolicy.reason ?? 'Scout requires approval before running this tool.',
            code: scoutPolicy.code,
          };
        }
        const ok = await confirm(
          call.toolName,
          call.params,
          scoutPolicy.reason ?? 'Scout policy requires confirmation.',
        );
        if (!ok) return { error: 'User declined Scout policy approval.' };
        call.params = { ...call.params, _confirmed: true };
      } else if (scoutPolicy.decision === 'block' || scoutPolicy.decision === 'quarantine_session') {
        return {
          error: scoutPolicy.reason ?? 'Blocked by Scout policy.',
          code: scoutPolicy.code,
        };
      }
    } else if (scoutPolicy.source === 'local_fallback' && scoutPolicy.reason) {
      void reportPolicyFallback(call.toolName, sessionId, scoutPolicy.reason);
    }
  }

  const policyError = await enforceToolPolicy(call.toolName, call.params, sessionId);
  if (policyError) {
    return policyError;
  }

  try {
    const paramsWithSession: Record<string, unknown> = {
      ...call.params,
      _sessionId: sessionId,
      _sandboxMode: sandboxResolution.mode,
      _sandboxPolicy: sandboxResolution.policyMode,
    };
    if (confirm) {
      paramsWithSession._confirm = confirm;
    }
    const ttlSeconds = getToolCacheTtlSeconds(call.toolName, call.params);
    const result = await withTimeout(
      withCache(call.toolName, call.params, ttlSeconds, () => tool.execute(paramsWithSession)),
      operatorPolicy.timeoutMs,
      call.toolName,
    );
    const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
    recordToolSequenceStep(sessionId, call.toolName, call.params);
    finalizeJitCredentials(sessionId, call.toolName, call.params);
    void reportToolCall({
      toolName: call.toolName,
      params: call.params,
      resultSummary: resultStr.slice(0, 200),
      durationMs: Date.now() - startTime,
      sessionId,
      success: true,
    });
    if (process.env.LABYRINTH_ENABLED === 'true') {
      const safeStr = await scanToolOutput(call.toolName, resultStr);
      if (typeof result === 'string') return safeStr;
      try {
        return JSON.parse(safeStr) as unknown;
      } catch {
        return safeStr;
      }
    }
    return result;
  } catch (err) {
    void reportToolCall({
      toolName: call.toolName,
      params: call.params,
      resultSummary: '',
      durationMs: Date.now() - startTime,
      sessionId,
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`Tool "${toolName}" timed out after ${timeoutMs}ms by operator policy.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
