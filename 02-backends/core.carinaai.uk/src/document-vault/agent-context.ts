/**
 * Trusted Document Vault agent context (prompt 712).
 * Workspace/actor come from the worker session; model-supplied tenants are never authoritative.
 */

import { getWorkerSessionContext } from '../workers/worker-session-context.js';
import { VaultError } from './service.js';

const HOST_PATH = /^(?:\/|~|[A-Za-z]:\\|\\\\)/;
const PUBLIC_AUDIENCES = new Set(['public', 'external', 'anonymous', 'world']);

export type VaultAgentContext = {
  workspaceId: string;
  actorId: string;
  sessionId: string;
  audience: 'private' | 'public';
  workerId: string | null;
  channel: string;
};

export function rejectHostPath(value: unknown): void {
  const text = String(value ?? '').trim();
  if (!text) return;
  if (text.startsWith('vault://')) return;
  if (HOST_PATH.test(text) || text.includes('..') || text.includes('\\')) {
    throw new VaultError('Document Vault tools reject host filesystem paths', 'forbidden');
  }
}

export function resolveVaultAgentContext(
  sessionId: string,
  args: Record<string, unknown> = {},
): VaultAgentContext {
  const workerCtx = getWorkerSessionContext(sessionId);
  if (!workerCtx?.worker?.workspaceId) {
    throw new VaultError('no trusted workspace in session context', 'forbidden');
  }
  if (workerCtx.audiencePrincipal) {
    throw new VaultError('public audience cannot access the private Document Vault', 'forbidden');
  }

  const trustedWs = String(workerCtx.worker.workspaceId).trim();
  const claimedWs = String(args.workspaceId ?? args.tenant_id ?? args.tenantId ?? '').trim();
  if (claimedWs && claimedWs !== trustedWs) {
    throw new VaultError('model-supplied workspace_id rejected', 'forbidden');
  }

  for (const key of ['path', 'host_path', 'file_path', 'local_path', 'cwd']) {
    if (key in args) rejectHostPath(args[key]);
  }

  return {
    workspaceId: trustedWs,
    actorId: String(workerCtx.worker.id || workerCtx.worker.userId || 'agent'),
    sessionId,
    audience: 'private',
    workerId: workerCtx.worker.id ?? null,
    channel: String(workerCtx.channel || 'agent'),
  };
}

export function assertSameWorkspaceItem(
  trustedWorkspaceId: string,
  itemWorkspaceId: string | null | undefined,
): void {
  if (!itemWorkspaceId || itemWorkspaceId !== trustedWorkspaceId) {
    throw new VaultError('cross-tenant item rejected', 'forbidden');
  }
}

export function isPublicAudienceLabel(value: unknown): boolean {
  return PUBLIC_AUDIENCES.has(String(value ?? '').trim().toLowerCase());
}
