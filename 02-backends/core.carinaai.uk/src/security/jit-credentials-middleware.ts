import {
  assertJitGrant,
  consumeJitGrant,
  issueJitGrantAfterConfirm,
  JitCredentialError,
  requiresJitGrant,
} from './jit-credentials.js';

export function enforceJitCredentials(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): { error: string; code: string } | null {
  try {
    assertJitGrant(sessionId, toolName, params);
    return null;
  } catch (err) {
    if (err instanceof JitCredentialError) {
      return { error: err.message, code: err.code };
    }
    throw err;
  }
}

export function grantJitCredentialsAfterConfirm(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!requiresJitGrant(toolName)) return;
  issueJitGrantAfterConfirm(sessionId, toolName, params);
}

export function finalizeJitCredentials(
  sessionId: string,
  toolName: string,
  params: Record<string, unknown>,
): void {
  if (!requiresJitGrant(toolName)) return;
  consumeJitGrant(sessionId, toolName, params);
}
