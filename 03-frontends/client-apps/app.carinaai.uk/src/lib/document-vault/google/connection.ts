import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import {
  documentVaultDriveConnections,
  documentVaultDriveNotifications,
  documentVaultProviderMappings,
} from '@/db/schema';
import { decryptKey, encryptKey } from '@/lib/vault';
import type { VaultDriveSyncMode } from './scopes';

export type DriveGrant = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: string | null;
  accountEmail?: string | null;
  scopes: string[];
};

export type DriveConnectionPublic = {
  workspaceId: string;
  connected: boolean;
  mode: VaultDriveSyncMode;
  accountEmail: string | null;
  scopes: string[];
  googleRootFolderId: string | null;
  googleRootFolderName: string | null;
  vaultRootItemId: string | null;
  pageToken: string | null;
  channelId: string | null;
  channelExpiresAt: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  sharedDrivesEnabled: boolean;
  watchActive: boolean;
};

function toPublic(
  row: typeof documentVaultDriveConnections.$inferSelect,
): DriveConnectionPublic {
  return {
    workspaceId: row.workspaceId,
    connected: row.connected,
    mode: (row.mode as VaultDriveSyncMode) || 'outbound_only',
    accountEmail: row.accountEmail,
    scopes: row.scopesJson ?? [],
    googleRootFolderId: row.googleRootFolderId,
    googleRootFolderName: row.googleRootFolderName,
    vaultRootItemId: row.vaultRootItemId,
    pageToken: row.pageToken,
    channelId: row.channelId,
    channelExpiresAt: row.channelExpiresAt ? row.channelExpiresAt.toISOString() : null,
    lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    lastError: row.lastError,
    sharedDrivesEnabled: row.sharedDrivesEnabled,
    watchActive: Boolean(row.channelId && row.resourceId),
  };
}

export async function getDriveConnection(workspaceId: string) {
  const [row] = await db
    .select()
    .from(documentVaultDriveConnections)
    .where(eq(documentVaultDriveConnections.workspaceId, workspaceId))
    .limit(1);
  return row ?? null;
}

export async function getDriveConnectionPublic(workspaceId: string): Promise<DriveConnectionPublic | null> {
  const row = await getDriveConnection(workspaceId);
  return row ? toPublic(row) : null;
}

export async function upsertDriveConnection(
  workspaceId: string,
  patch: Partial<{
    connected: boolean;
    mode: string;
    accountEmail: string | null;
    scopesJson: string[];
    googleRootFolderId: string | null;
    googleRootFolderName: string | null;
    vaultRootItemId: string | null;
    pageToken: string | null;
    channelId: string | null;
    resourceId: string | null;
    channelExpiresAt: Date | null;
    verificationTokenHash: string | null;
    lastSyncAt: Date | null;
    lastError: string | null;
    encryptedGrant: string | null;
    grantIv: string | null;
    grantTag: string | null;
    sharedDrivesEnabled: boolean;
  }>,
): Promise<DriveConnectionPublic> {
  const existing = await getDriveConnection(workspaceId);
  const now = new Date();
  if (!existing) {
    const [row] = await db
      .insert(documentVaultDriveConnections)
      .values({
        workspaceId,
        connected: patch.connected ?? false,
        mode: patch.mode ?? 'outbound_only',
        accountEmail: patch.accountEmail ?? null,
        scopesJson: patch.scopesJson ?? [],
        googleRootFolderId: patch.googleRootFolderId ?? null,
        googleRootFolderName: patch.googleRootFolderName ?? null,
        vaultRootItemId: patch.vaultRootItemId ?? null,
        pageToken: patch.pageToken ?? null,
        channelId: patch.channelId ?? null,
        resourceId: patch.resourceId ?? null,
        channelExpiresAt: patch.channelExpiresAt ?? null,
        verificationTokenHash: patch.verificationTokenHash ?? null,
        lastSyncAt: patch.lastSyncAt ?? null,
        lastError: patch.lastError ?? null,
        encryptedGrant: patch.encryptedGrant ?? null,
        grantIv: patch.grantIv ?? null,
        grantTag: patch.grantTag ?? null,
        sharedDrivesEnabled: patch.sharedDrivesEnabled ?? false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toPublic(row!);
  }
  const [row] = await db
    .update(documentVaultDriveConnections)
    .set({ ...patch, updatedAt: now })
    .where(eq(documentVaultDriveConnections.workspaceId, workspaceId))
    .returning();
  return toPublic(row!);
}

export function sealGrant(workspaceId: string, grant: DriveGrant): {
  encryptedGrant: string;
  grantIv: string;
  grantTag: string;
} {
  const sealed = encryptKey(JSON.stringify(grant), workspaceId);
  return {
    encryptedGrant: sealed.encrypted,
    grantIv: sealed.iv,
    grantTag: sealed.tag,
  };
}

export function openGrant(
  workspaceId: string,
  row: typeof documentVaultDriveConnections.$inferSelect,
): DriveGrant | null {
  if (!row.encryptedGrant || !row.grantIv || !row.grantTag) return null;
  try {
    const raw = decryptKey(row.encryptedGrant, row.grantIv, row.grantTag, workspaceId);
    const parsed = JSON.parse(raw) as DriveGrant;
    if (!parsed.accessToken && !parsed.refreshToken) return null;
    return {
      accessToken: parsed.accessToken ?? '',
      refreshToken: parsed.refreshToken ?? '',
      expiresAt: parsed.expiresAt ?? null,
      accountEmail: parsed.accountEmail ?? null,
      scopes: parsed.scopes ?? [],
    };
  } catch {
    return null;
  }
}

export async function seenDriveNotification(workspaceId: string, notificationId: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(documentVaultDriveNotifications)
    .where(
      and(
        eq(documentVaultDriveNotifications.workspaceId, workspaceId),
        eq(documentVaultDriveNotifications.notificationId, notificationId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function recordDriveNotification(workspaceId: string, notificationId: string): Promise<void> {
  await db
    .insert(documentVaultDriveNotifications)
    .values({ workspaceId, notificationId })
    .onConflictDoNothing();
}

export async function getMappingByProviderId(workspaceId: string, providerItemId: string) {
  const [row] = await db
    .select()
    .from(documentVaultProviderMappings)
    .where(
      and(
        eq(documentVaultProviderMappings.workspaceId, workspaceId),
        eq(documentVaultProviderMappings.provider, 'google_drive'),
        eq(documentVaultProviderMappings.providerItemId, providerItemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getMappingByItemId(workspaceId: string, itemId: string) {
  const [row] = await db
    .select()
    .from(documentVaultProviderMappings)
    .where(
      and(
        eq(documentVaultProviderMappings.workspaceId, workspaceId),
        eq(documentVaultProviderMappings.provider, 'google_drive'),
        eq(documentVaultProviderMappings.itemId, itemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function upsertProviderMapping(input: {
  workspaceId: string;
  itemId: string;
  providerItemId: string;
  providerRevisionToken?: string | null;
  syncStatus?: string;
  contentAuthority?: string;
  conflictState?: string | null;
  localChecksum?: string | null;
  remoteChecksum?: string | null;
  metadataJson?: Record<string, unknown>;
}) {
  const existing = await getMappingByProviderId(input.workspaceId, input.providerItemId);
  const now = new Date();
  if (existing) {
    const [row] = await db
      .update(documentVaultProviderMappings)
      .set({
        itemId: input.itemId,
        providerRevisionToken: input.providerRevisionToken ?? existing.providerRevisionToken,
        syncStatus: input.syncStatus ?? existing.syncStatus,
        contentAuthority: input.contentAuthority ?? existing.contentAuthority,
        conflictState: input.conflictState === undefined ? existing.conflictState : input.conflictState,
        localChecksum: input.localChecksum ?? existing.localChecksum,
        remoteChecksum: input.remoteChecksum ?? existing.remoteChecksum,
        metadataJson: input.metadataJson ?? existing.metadataJson,
        lastSyncedAt: now,
        updatedAt: now,
      })
      .where(eq(documentVaultProviderMappings.id, existing.id))
      .returning();
    return row!;
  }
  const [row] = await db
    .insert(documentVaultProviderMappings)
    .values({
      workspaceId: input.workspaceId,
      itemId: input.itemId,
      provider: 'google_drive',
      providerItemId: input.providerItemId,
      providerRevisionToken: input.providerRevisionToken ?? null,
      syncStatus: input.syncStatus ?? 'synced',
      contentAuthority: input.contentAuthority ?? 'workspace',
      conflictState: input.conflictState ?? null,
      localChecksum: input.localChecksum ?? null,
      remoteChecksum: input.remoteChecksum ?? null,
      metadataJson: input.metadataJson ?? {},
      lastSyncedAt: now,
      updatedAt: now,
    })
    .returning();
  return row!;
}
