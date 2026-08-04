/**
 * Strict multi-tenant isolation helpers for hosted Aiva / Carina Ops.
 *
 * Rules:
 * 1. Every Aiva read/write of contacts, memory, docs, notes, research, and media
 *    must be keyed by workspaceId (and workerId / contactId where applicable).
 * 2. Host-operator stores (cronjob, SHARED_MEMORY, unscoped contacts, env Google
 *    tokens, research disk index) must never be reachable from an Aiva session.
 * 3. When HOSTED_MODE or CARINA_OPS_PRODUCT_ENABLED is on, unscoped list APIs
 *    must refuse rather than return another tenant's data.
 */

import { getWorkerSessionContext } from '../workers/worker-session-context.js';

export function isHostedMultiTenant(): boolean {
  return process.env.HOSTED_MODE === 'true'
    || process.env.CARINA_OPS_PRODUCT_ENABLED === 'true';
}

export function isAivaSessionId(sessionId: string | undefined | null): boolean {
  return Boolean(sessionId && String(sessionId).startsWith('aiva-'));
}

/** Prefer full UUID filenames; never truncate to a shared prefix. */
export function workspaceScopedFileToken(workspaceId: string): string {
  return workspaceId.trim().toLowerCase();
}

export function resolveWorkspaceIdFromSession(
  sessionId: string | undefined | null,
): string | undefined {
  if (!sessionId) return undefined;
  const ctx = getWorkerSessionContext(String(sessionId));
  const id = ctx?.worker?.workspaceId?.trim();
  return id || undefined;
}

export function requireWorkspaceIdForHosted(
  workspaceId: string | undefined | null,
  label = 'x-workspace-id',
): { ok: true; workspaceId: string } | { ok: false; error: string } {
  const id = typeof workspaceId === 'string' ? workspaceId.trim() : '';
  if (id) return { ok: true, workspaceId: id };
  if (isHostedMultiTenant()) {
    return { ok: false, error: `${label} is required on this multi-tenant host` };
  }
  return { ok: false, error: `${label} is required` };
}

/**
 * Host-only tools that can leak across Aiva tenants if left enabled.
 * Kept in sync with WORKSPACE_SECURITY_BLOCKED_TOOLS additions.
 */
export const AIVA_HOST_LEAK_TOOLS = [
  'cronjob',
  'research-list',
  'images-gallery',
  'session-search',
  'memory',
  'agent-sync',
  'github-agent-sync',
] as const;

export function isHostLeakTool(toolName: string): boolean {
  return (AIVA_HOST_LEAK_TOOLS as readonly string[]).includes(toolName);
}
