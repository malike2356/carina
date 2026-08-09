import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { documentVaultItems } from '@/db/schema';
import {
  createVaultItem,
  getVaultContent,
  getVaultItem,
  trashVaultItem,
  updateVaultContent,
} from '@/lib/document-vault/pg-store';
import {
  getDriveConnection,
  getMappingByItemId,
  getMappingByProviderId,
  recordDriveNotification,
  seenDriveNotification,
  upsertDriveConnection,
  upsertProviderMapping,
} from './connection';
import {
  createGoogleDoc,
  getStartPageToken,
  listChanges,
  resumableUploadText,
  vaultKindForGoogleMime,
  type DriveFileMeta,
} from './drive-api';
import { resolveVaultDriveAccessToken } from './token';
import type { VaultKind } from '@/lib/document-vault/pg-store';

export type ReconcileSource = 'poll' | 'webhook' | 'manual' | 'outbound';

export type ReconcileResult = {
  workspaceId: string;
  source: ReconcileSource;
  applied: number;
  conflicts: number;
  skipped: number;
  pages: number;
  newPageToken: string | null;
  errors: string[];
  duplicateNotification: boolean;
};

function sanitizeName(name: string): string {
  const trimmed = name.trim().replace(/[\u0000-\u001f\\/]/g, '_');
  if (!trimmed || trimmed === '.' || trimmed === '..') return 'Untitled';
  return trimmed.replace(/\.\./g, '_').slice(0, 255);
}

function asCreateKind(kind: string): VaultKind {
  const allowed: VaultKind[] = [
    'folder',
    'markdown',
    'html',
    'plain_text',
    'spreadsheet',
    'rich_document',
    'presentation',
    'pdf',
  ];
  if (allowed.includes(kind as VaultKind)) return kind as VaultKind;
  return 'plain_text';
}

export async function reconcileInbound(opts: {
  workspaceId: string;
  source?: ReconcileSource;
  actorId?: string | null;
  notificationId?: string | null;
  maxPages?: number;
}): Promise<ReconcileResult> {
  const source = opts.source ?? 'manual';
  const result: ReconcileResult = {
    workspaceId: opts.workspaceId,
    source,
    applied: 0,
    conflicts: 0,
    skipped: 0,
    pages: 0,
    newPageToken: null,
    errors: [],
    duplicateNotification: false,
  };

  const conn = await getDriveConnection(opts.workspaceId);
  if (!conn?.connected) throw new Error('Google Drive not connected for this workspace');
  if (conn.mode === 'outbound_only') throw new Error('inbound sync disabled for outbound_only mode');

  if (opts.notificationId) {
    if (await seenDriveNotification(opts.workspaceId, opts.notificationId)) {
      result.duplicateNotification = true;
      result.skipped = 1;
      return result;
    }
    await recordDriveNotification(opts.workspaceId, opts.notificationId);
  }

  const accessToken = await resolveVaultDriveAccessToken(opts.workspaceId);
  let pageToken = conn.pageToken || '';
  if (!pageToken) pageToken = await getStartPageToken(accessToken);

  const maxPages = opts.maxPages ?? 50;
  let pages = 0;
  while (pages < maxPages) {
    pages += 1;
    result.pages = pages;
    try {
      const payload = await listChanges(accessToken, pageToken, { pageSize: 100 });
      for (const change of payload.changes) {
        try {
          const outcome = await applyChange(
            opts.workspaceId,
            change,
            opts.actorId ?? null,
            conn.vaultRootItemId,
          );
          if (outcome === 'conflict') result.conflicts += 1;
          else if (outcome === 'applied') result.applied += 1;
          else result.skipped += 1;
        } catch (err) {
          result.errors.push(err instanceof Error ? err.message : String(err));
        }
      }
      if (payload.nextPageToken) {
        pageToken = payload.nextPageToken;
        continue;
      }
      if (payload.newStartPageToken) pageToken = payload.newStartPageToken;
      result.newPageToken = pageToken;
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(message);
      await upsertDriveConnection(opts.workspaceId, { lastError: message });
      break;
    }
  }

  await upsertDriveConnection(opts.workspaceId, {
    pageToken: result.newPageToken || pageToken,
    lastSyncAt: new Date(),
    lastError: result.errors.length ? result.errors.join('; ') : null,
  });
  return result;
}

async function applyChange(
  workspaceId: string,
  change: { fileId?: string; removed?: boolean; file?: DriveFileMeta },
  actorId: string | null,
  vaultRootItemId: string | null,
): Promise<'applied' | 'conflict' | 'skipped'> {
  const fileId = String(change.fileId || change.file?.id || '');
  if (!fileId) return 'skipped';
  const mapping = await getMappingByProviderId(workspaceId, fileId);
  const meta = change.file || {};
  const removed = Boolean(change.removed) || Boolean(meta.trashed);

  if (removed) {
    if (!mapping) return 'skipped';
    const item = await getVaultItem(workspaceId, mapping.itemId);
    if (item && !item.trashedAt) await trashVaultItem(workspaceId, mapping.itemId, actorId);
    await upsertProviderMapping({
      workspaceId,
      itemId: mapping.itemId,
      providerItemId: fileId,
      providerRevisionToken: mapping.providerRevisionToken,
      contentAuthority: 'google',
      syncStatus: 'tombstone',
      metadataJson: { tombstone: true },
    });
    return 'applied';
  }

  const name = sanitizeName(String(meta.name || 'Untitled'));
  const mime = String(meta.mimeType || 'application/octet-stream');
  const kind = vaultKindForGoogleMime(mime);
  const remoteRev = String(meta.version || meta.headRevisionId || '');

  if (mapping) {
    const item = await getVaultItem(workspaceId, mapping.itemId);
    if (!item) return 'skipped';
    const lastSynced = mapping.lastSyncedAt?.toISOString() ?? '';
    const localDirty =
      item.contentAuthority === 'workspace' && Boolean(lastSynced) && item.updatedAt > lastSynced;
    const mappedRev = String(mapping.providerRevisionToken || '');
    if (localDirty && mappedRev && remoteRev && mappedRev !== remoteRev) {
      const conflict = await createVaultItem({
        workspaceId,
        parentId: item.parentId,
        kind: asCreateKind(kind === 'folder' ? 'markdown' : kind),
        name: `${name} (Google conflict)`,
        content: `Remote Google revision ${remoteRev} preserved alongside local edits.`,
        actorId,
      });
      await db
        .update(documentVaultItems)
        .set({ contentAuthority: 'google', conflict: true, syncStatus: 'conflict' })
        .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, conflict.id)));
      await db
        .update(documentVaultItems)
        .set({ conflict: true, syncStatus: 'conflict' })
        .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, item.id)));
      await upsertProviderMapping({
        workspaceId,
        itemId: item.id,
        providerItemId: fileId,
        providerRevisionToken: mappedRev,
        contentAuthority: 'workspace',
        conflictState: 'both_preserved',
        metadataJson: { remote_revision: remoteRev, conflict_item_id: conflict.id },
      });
      await upsertProviderMapping({
        workspaceId,
        itemId: conflict.id,
        providerItemId: `${fileId}:conflict:${remoteRev}`,
        providerRevisionToken: remoteRev,
        contentAuthority: 'google',
        conflictState: 'both_preserved',
        metadataJson: { source_item_id: item.id },
      });
      return 'conflict';
    }

    if (item.name !== name) {
      await db
        .update(documentVaultItems)
        .set({ name, updatedAt: new Date(), syncStatus: 'synced', conflict: false })
        .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, item.id)));
    }
    await upsertProviderMapping({
      workspaceId,
      itemId: item.id,
      providerItemId: fileId,
      providerRevisionToken: remoteRev,
      contentAuthority: 'google',
      conflictState: null,
      syncStatus: 'synced',
      metadataJson: { mimeType: mime },
    });
    return 'applied';
  }

  const created = await createVaultItem({
    workspaceId,
    parentId: vaultRootItemId,
    kind: asCreateKind(kind),
    name,
    content: '',
    actorId,
  });
  await db
    .update(documentVaultItems)
    .set({ contentAuthority: 'google', syncStatus: 'synced' })
    .where(and(eq(documentVaultItems.workspaceId, workspaceId), eq(documentVaultItems.id, created.id)));
  await upsertProviderMapping({
    workspaceId,
    itemId: created.id,
    providerItemId: fileId,
    providerRevisionToken: remoteRev,
    contentAuthority: 'google',
    syncStatus: 'synced',
    metadataJson: { mimeType: mime },
  });
  return 'applied';
}

export async function pushVaultItemToDrive(opts: {
  workspaceId: string;
  itemId: string;
  actorId?: string | null;
}): Promise<{ providerItemId: string; revision: string | null }> {
  const conn = await getDriveConnection(opts.workspaceId);
  if (!conn?.connected) throw new Error('Google Drive not connected');
  if (conn.mode === 'inbound_only') throw new Error('outbound push disabled for inbound_only mode');

  const item = await getVaultItem(opts.workspaceId, opts.itemId);
  if (!item || item.trashedAt) throw new Error('Item not found');
  if (item.conflict) throw new Error('Resolve sync conflict before pushing');
  if (item.kind === 'folder') throw new Error('Folder push is handled during root setup');

  const accessToken = await resolveVaultDriveAccessToken(opts.workspaceId);
  const content = (await getVaultContent(opts.workspaceId, opts.itemId)) ?? '';
  const mapping = await getMappingByItemId(opts.workspaceId, opts.itemId);

  let remote: DriveFileMeta;
  if (mapping?.providerItemId && !mapping.providerItemId.includes(':conflict:')) {
    remote = await resumableUploadText({
      accessToken,
      name: item.name,
      mimeType: item.mimeType || 'text/plain',
      content,
      fileId: mapping.providerItemId,
    });
  } else if (item.kind === 'html' || item.kind === 'rich_document') {
    remote = await createGoogleDoc({
      accessToken,
      name: item.name,
      parentId: conn.googleRootFolderId ?? undefined,
    });
  } else {
    remote = await resumableUploadText({
      accessToken,
      name: item.name,
      mimeType: item.mimeType || 'text/plain',
      content,
      parentId: conn.googleRootFolderId ?? undefined,
    });
  }

  const rev = String(remote.version || remote.headRevisionId || '');
  await upsertProviderMapping({
    workspaceId: opts.workspaceId,
    itemId: opts.itemId,
    providerItemId: remote.id,
    providerRevisionToken: rev,
    contentAuthority: 'workspace',
    syncStatus: 'synced',
    conflictState: null,
    localChecksum: item.checksum,
    remoteChecksum: rev,
  });
  await db
    .update(documentVaultItems)
    .set({ syncStatus: 'synced', conflict: false, updatedAt: new Date() })
    .where(
      and(
        eq(documentVaultItems.workspaceId, opts.workspaceId),
        eq(documentVaultItems.id, opts.itemId),
      ),
    );

  return { providerItemId: remote.id, revision: rev || null };
}

export async function resolveConflictKeepLocal(opts: {
  workspaceId: string;
  itemId: string;
  actorId?: string | null;
}): Promise<void> {
  const mapping = await getMappingByItemId(opts.workspaceId, opts.itemId);
  await db
    .update(documentVaultItems)
    .set({ conflict: false, syncStatus: 'synced', contentAuthority: 'workspace' })
    .where(
      and(eq(documentVaultItems.workspaceId, opts.workspaceId), eq(documentVaultItems.id, opts.itemId)),
    );
  const conflictId =
    mapping?.metadataJson && typeof mapping.metadataJson === 'object'
      ? (mapping.metadataJson as { conflict_item_id?: string }).conflict_item_id
      : undefined;
  if (conflictId) await trashVaultItem(opts.workspaceId, conflictId, opts.actorId);
  await upsertProviderMapping({
    workspaceId: opts.workspaceId,
    itemId: opts.itemId,
    providerItemId: mapping?.providerItemId ?? opts.itemId,
    conflictState: null,
    contentAuthority: 'workspace',
    syncStatus: 'synced',
  });
}

export async function resolveConflictKeepGoogle(opts: {
  workspaceId: string;
  itemId: string;
  actorId?: string | null;
}): Promise<void> {
  const mapping = await getMappingByItemId(opts.workspaceId, opts.itemId);
  const meta = (mapping?.metadataJson ?? {}) as {
    conflict_item_id?: string;
    remote_revision?: string;
  };
  if (meta.conflict_item_id) {
    const remoteContent =
      (await getVaultContent(opts.workspaceId, meta.conflict_item_id)) ??
      `Adopted Google revision ${meta.remote_revision ?? ''}`.trim();
    await updateVaultContent({
      workspaceId: opts.workspaceId,
      itemId: opts.itemId,
      content: remoteContent,
      actorId: opts.actorId,
    });
    await trashVaultItem(opts.workspaceId, meta.conflict_item_id, opts.actorId);
  }
  await db
    .update(documentVaultItems)
    .set({ conflict: false, syncStatus: 'synced', contentAuthority: 'google' })
    .where(
      and(eq(documentVaultItems.workspaceId, opts.workspaceId), eq(documentVaultItems.id, opts.itemId)),
    );
  await upsertProviderMapping({
    workspaceId: opts.workspaceId,
    itemId: opts.itemId,
    providerItemId: String(mapping?.providerItemId ?? opts.itemId).split(':conflict:')[0]!,
    providerRevisionToken: meta.remote_revision ?? mapping?.providerRevisionToken,
    conflictState: null,
    contentAuthority: 'google',
    syncStatus: 'synced',
  });
}
