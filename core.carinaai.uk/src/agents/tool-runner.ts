import type { Tool, ToolCall } from '../types/index.js';
import { registry } from '../tools/index.js';
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

  const tool = registry.get(call.toolName);
  if (!tool) {
    return { error: `Unknown tool: ${call.toolName}` };
  }

  if (tool.dangerous) {
    console.warn(`[dangerous tool] ${call.toolName}`);
  }

  const needsJitApproval = requiresJitGrant(call.toolName)
    && !getJitCredentialStore().hasValidGrant(sessionId, call.toolName, call.params)
    && call.params._jit_granted !== true;

  const mustConfirm =
    alwaysConfirm || needsJitApproval || (await needsUserConfirmation(tool, call.params));
  if (mustConfirm) {
    if (!confirm) {
      return { error: 'Tool requires confirmation but no confirm handler is configured.' };
    }
    const reason = tool.dangerous
      ? 'This tool is marked dangerous.'
      : 'Confirmation required before running.';
    const ok = await confirm(call.toolName, call.params, reason);
    if (!ok) {
      return { error: 'User declined tool execution.' };
    }
    call.params = { ...call.params, _confirmed: true };
    grantJitCredentialsAfterConfirm(sessionId, call.toolName, call.params);
  }

  const sequenceError = await enforceToolSequence(sessionId, call.toolName, call.params);
  if (sequenceError) return sequenceError;

  const jitError = enforceJitCredentials(sessionId, call.toolName, call.params);
  if (jitError) return jitError;

  const policyError = await enforceToolPolicy(call.toolName, call.params, sessionId);
  if (policyError) {
    return policyError;
  }

  try {
    const paramsWithSession = { ...call.params, _sessionId: sessionId };
    const ttlSeconds = getToolCacheTtlSeconds(call.toolName, call.params);
    const result = await withCache(call.toolName, call.params, ttlSeconds, () =>
      tool.execute(paramsWithSession),
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
