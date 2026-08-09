/**
 * Trusted channel identity binding for Document Vault (prompt 713).
 * Unbound, revoked, public, and anonymous identities have no vault access.
 * Workspace is never inferred from message text, filenames, or model args.
 */

import { documentVaultFlags } from '../flags.js';
import { DocumentVaultService, VaultError } from '../service.js';
import { getOrCreateLocalVaultService } from '../runtime.js';

const PUBLIC = new Set(['public', 'external', 'anonymous', 'world']);
const ANON_USERS = new Set(['', 'anonymous', 'stranger', 'unknown', 'public']);

export type ChannelVaultContext = {
  workspaceId: string;
  actorId: string;
  audience: 'private' | string;
  sessionId: string;
  channel: string;
  grants: string[];
};

function store(svc?: DocumentVaultService): DocumentVaultService {
  return svc ?? getOrCreateLocalVaultService();
}

export function resolveChannelBinding(
  platform: string,
  channelUserId: string,
  options: {
    claimedWorkspaceId?: string | null;
    service?: DocumentVaultService;
  } = {},
): ChannelVaultContext {
  const flags = documentVaultFlags();
  if (!flags.channelOps) {
    throw new VaultError('Document Vault channel ops disabled', 'not_configured');
  }

  const platformKey = String(platform || '').trim().toLowerCase();
  const userKey = String(channelUserId || '').trim();
  if (!platformKey || ANON_USERS.has(userKey.toLowerCase())) {
    throw new VaultError('channel identity is unbound or anonymous', 'channel_unbound');
  }

  const row = store(options.service).getChannelBinding(platformKey, userKey);
  if (!row) {
    throw new VaultError('no Document Vault binding for this channel identity', 'channel_unbound');
  }
  const status = String(row.status || '');
  if (status === 'revoked') {
    throw new VaultError('channel Document Vault binding revoked', 'channel_revoked');
  }
  if (status !== 'active') {
    throw new VaultError(`channel binding status is ${status}`, 'channel_unbound');
  }

  const audience = String(row.audience || 'private').toLowerCase();
  if (PUBLIC.has(audience)) {
    throw new VaultError('public channel audience cannot access private Document Vault', 'forbidden');
  }

  const workspaceId = String(row.workspaceId || '').trim();
  if (!workspaceId) {
    throw new VaultError('binding missing workspace', 'channel_unbound');
  }

  const claimed = String(options.claimedWorkspaceId || '').trim();
  if (claimed && claimed !== workspaceId) {
    throw new VaultError('claimed workspace does not match channel binding', 'forbidden');
  }

  const grants = Array.isArray(row.grants) ? row.grants.map(String) : [];
  return {
    workspaceId,
    actorId: String(row.actorId || userKey),
    audience: audience || 'private',
    sessionId: `${platformKey}:${userKey}`,
    channel: platformKey,
    grants,
  };
}

/**
 * Bind a channel identity to a trusted workspace (owner/worker route).
 * Never accepts a public audience.
 */
export function bindChannelIdentity(input: {
  workspaceId: string;
  platform: string;
  channelUserId: string;
  actorId?: string;
  audience?: string;
  grants?: string[];
  service?: DocumentVaultService;
}): Record<string, unknown> {
  const ws = String(input.workspaceId || '').trim();
  const platformKey = String(input.platform || '').trim().toLowerCase();
  const userKey = String(input.channelUserId || '').trim();
  if (!ws || !platformKey || ANON_USERS.has(userKey.toLowerCase())) {
    throw new VaultError('workspace, platform, and channel_user_id required', 'validation');
  }
  if (PUBLIC.has(String(input.audience || 'private').toLowerCase())) {
    throw new VaultError('cannot bind public audience to private Document Vault', 'forbidden');
  }
  return store(input.service).upsertChannelBinding({
    workspaceId: ws,
    platform: platformKey,
    channelUserId: userKey,
    actorId: String(input.actorId || userKey),
    audience: input.audience || 'private',
    grants: input.grants ?? ['vault.read', 'vault.write', 'vault.search', 'vault.export'],
    status: 'active',
  });
}

/**
 * Auto-bind from a trusted Aiva worker session (workspace already known from webhook routing).
 * Does not revive a revoked binding.
 */
export function ensureWorkerChannelBinding(input: {
  workspaceId: string;
  platform: string;
  channelUserId: string;
  actorId: string;
  service?: DocumentVaultService;
}): ChannelVaultContext {
  const platformKey = String(input.platform || '').trim().toLowerCase();
  const userKey = String(input.channelUserId || '').trim();
  const existing = store(input.service).getChannelBinding(platformKey, userKey);
  if (existing && String(existing.status) === 'revoked') {
    throw new VaultError('channel Document Vault binding revoked', 'channel_revoked');
  }
  if (
    existing
    && String(existing.status) === 'active'
    && String(existing.workspaceId) !== input.workspaceId
  ) {
    throw new VaultError(
      'channel identity already bound to another workspace',
      'forbidden',
    );
  }
  if (!existing) {
    bindChannelIdentity({
      workspaceId: input.workspaceId,
      platform: platformKey,
      channelUserId: userKey,
      actorId: input.actorId,
      service: input.service,
    });
  }
  return resolveChannelBinding(platformKey, userKey, { service: input.service });
}

export function revokeChannelBinding(
  platform: string,
  channelUserId: string,
  options: { service?: DocumentVaultService } = {},
): Record<string, unknown> | null {
  return store(options.service).setChannelBindingStatus(
    String(platform || '').trim().toLowerCase(),
    String(channelUserId || '').trim(),
    'revoked',
  );
}
