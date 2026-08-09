import { createHash } from 'node:crypto';
import type {
  Classification,
  ContentAuthority,
  IndexPolicy,
  VaultItemKind,
} from './kinds.js';

export type VaultStorageLocator =
  | { scheme: 'inline'; }
  | { scheme: 'sandbox'; relativePath: string }
  | { scheme: 'object'; bucket: string; key: string };

export type VaultItem = {
  id: string;
  workspaceId: string;
  parentId: string | null;
  kind: VaultItemKind;
  name: string;
  mimeType: string;
  extension: string | null;
  contentAuthority: ContentAuthority;
  storageLocator: VaultStorageLocator;
  byteSize: number;
  checksum: string;
  currentRevision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  trashedAt: string | null;
  trashParentId: string | null;
  indexPolicy: IndexPolicy;
  classification: Classification;
};

export type VaultRevision = {
  id: string;
  itemId: string;
  workspaceId: string;
  revision: number;
  checksum: string;
  byteSize: number;
  storageLocator: VaultStorageLocator;
  createdBy: string | null;
  createdAt: string;
  note: string | null;
};

export type VaultProviderMapping = {
  id: string;
  workspaceId: string;
  itemId: string;
  provider: 'google';
  providerItemId: string;
  providerRevisionToken: string | null;
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error' | 'deleted';
  localChecksum: string | null;
  remoteChecksum: string | null;
  lastSyncedAt: string | null;
  updatedAt: string;
};

export type VaultJob = {
  id: string;
  workspaceId: string;
  kind: string;
  payloadJson: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VaultAuditEvent = {
  id: string;
  workspaceId: string;
  itemId: string | null;
  actorId: string | null;
  action: string;
  detailJson: string;
  createdAt: string;
};

export type VaultLegacyMapping = {
  id: string;
  workspaceId: string;
  legacySource: string;
  legacyId: string;
  itemId: string;
  checksum: string;
  createdAt: string;
};

export type VaultQuota = {
  workspaceId: string;
  maxBytes: number;
  usedBytes: number;
};

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function locatorToJson(locator: VaultStorageLocator): string {
  return JSON.stringify(locator);
}

export function locatorFromJson(raw: string): VaultStorageLocator {
  const parsed = JSON.parse(raw) as VaultStorageLocator;
  if (parsed.scheme === 'inline' || parsed.scheme === 'sandbox' || parsed.scheme === 'object') {
    return parsed;
  }
  throw new Error(`Unsupported storage locator: ${raw}`);
}
