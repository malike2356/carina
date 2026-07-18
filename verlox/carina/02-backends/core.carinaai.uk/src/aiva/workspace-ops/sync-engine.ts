import {
  DOC_CHAR_LIMIT,
  getKnowledgeEntry,
  insertKnowledgeDocument,
  truncateDocumentText,
  updateKnowledgeDocument,
} from '../../workers/knowledge-base.js';
import { hashDocumentContent } from './hash.js';
import {
  createGoogleDoc,
  exportDriveFileText,
  getDriveFile,
  listDriveChildren,
  resolveWorkerDriveToken,
  trashDriveFile,
  updateGoogleDocText,
  type DriveFileMeta,
} from './drive-client.js';
import { isFolderAllowedInOpsTree } from './browse.js';
import {
  finishSyncRun,
  getBinding,
  getMappingByDocument,
  getMappingByDriveFile,
  listFolders,
  listMappings,
  markMappingDeleted,
  startSyncRun,
  updateBindingSyncState,
  upsertMapping,
} from './store.js';
import type { OpsCategory, SyncDirection, WorkspaceOpsBinding } from './types.js';
import { isOpsCategory } from './types.js';

export type SyncResult = {
  runId: string;
  pulled: number;
  pushed: number;
  conflicts: number;
  skipped: number;
  error?: string;
};

function categoryForFolder(
  folders: Array<{ category: OpsCategory; folderId: string }>,
  parentId: string | undefined,
): OpsCategory {
  if (!parentId) return 'inbox';
  const hit = folders.find((f) => f.folderId === parentId);
  return hit?.category ?? 'inbox';
}

function driveModifiedMs(file: DriveFileMeta): number {
  return file.modifiedTime ? Date.parse(file.modifiedTime) : 0;
}

function aivaModifiedMs(iso: string | null | undefined): number {
  return iso ? Date.parse(iso) : 0;
}

/** Soft Wall / usage gates never apply here; sync is not chat inference. */
export async function runWorkspaceOpsSync(opts: {
  workspaceId: string;
  workerId: string;
  direction?: SyncDirection;
}): Promise<SyncResult> {
  const direction = opts.direction ?? 'both';
  const binding = await getBinding(opts.workspaceId, opts.workerId);
  if (!binding?.rootFolderId) {
    throw new Error('Workspace Ops is not bootstrapped for this worker');
  }

  const run = await startSyncRun({
    bindingId: binding.id,
    workspaceId: binding.workspaceId,
    direction,
  });

  let pulled = 0;
  let pushed = 0;
  let conflicts = 0;
  let skipped = 0;

  try {
    const accessToken = await resolveWorkerDriveToken(binding.workspaceId, binding.workerId);
    const folders = await listFolders(binding.id);

    if (direction === 'pull' || direction === 'both') {
      const pullStats = await pullFromDrive({ binding, accessToken, folders });
      pulled = pullStats.pulled;
      conflicts += pullStats.conflicts;
      skipped += pullStats.skipped;
    }

    if (direction === 'push' || direction === 'both') {
      const pushStats = await pushPendingToDrive({ binding, accessToken, folders });
      pushed = pushStats.pushed;
      skipped += pushStats.skipped;
    }

    await updateBindingSyncState(binding.id, {
      lastSyncAt: new Date(),
      lastSyncDirection: direction,
      lastError: null,
      lastConflictAt: conflicts > 0 ? new Date() : undefined,
      lastConflictSummary:
        conflicts > 0 ? `${conflicts} conflict(s) resolved by last-writer-wins` : undefined,
    });
    await finishSyncRun(run.id, {
      status: 'success',
      pulled,
      pushed,
      conflicts,
      skipped,
    });
    return { runId: run.id, pulled, pushed, conflicts, skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateBindingSyncState(binding.id, {
      lastSyncAt: new Date(),
      lastSyncDirection: direction,
      lastError: message,
    });
    await finishSyncRun(run.id, {
      status: 'error',
      pulled,
      pushed,
      conflicts,
      skipped,
      error: message,
    });
    return { runId: run.id, pulled, pushed, conflicts, skipped, error: message };
  }
}

async function pullFromDrive(opts: {
  binding: WorkspaceOpsBinding;
  accessToken: string;
  folders: Array<{ category: OpsCategory; folderId: string }>;
}): Promise<{ pulled: number; conflicts: number; skipped: number }> {
  let pulled = 0;
  let conflicts = 0;
  let skipped = 0;

  for (const folder of opts.folders) {
    let pageToken: string | undefined;
    do {
      const page = await listDriveChildren({
        accessToken: opts.accessToken,
        folderId: folder.folderId,
        pageToken,
      });
      for (const file of page.files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          skipped += 1;
          continue;
        }
        const parentId = file.parents?.[0] ?? folder.folderId;
        const category = categoryForFolder(opts.folders, parentId);
        const result = await upsertFromDriveFile({
          binding: opts.binding,
          accessToken: opts.accessToken,
          file,
          category,
        });
        if (result.result === 'pulled') pulled += 1;
        else if (result.result === 'conflict') {
          pulled += 1;
          conflicts += 1;
        } else skipped += 1;
      }
      pageToken = page.nextPageToken;
    } while (pageToken);
  }

  return { pulled, conflicts, skipped };
}

async function upsertFromDriveFile(opts: {
  binding: WorkspaceOpsBinding;
  accessToken: string;
  file: DriveFileMeta;
  category: OpsCategory;
}): Promise<{
  result: 'pulled' | 'conflict' | 'skipped';
  aivaDocumentId: string | null;
  syncStatus: string;
  indexable: boolean;
  driveNewer: boolean;
}> {
  const existing = await getMappingByDriveFile(opts.binding.id, opts.file.id);
  const text = await exportDriveFileText(opts.accessToken, opts.file);
  const indexable = text != null;
  const content = truncateDocumentText(
    text ??
      `Drive file "${opts.file.name}" is not text-indexable.\nOpen in Drive: ${opts.file.webViewLink ?? opts.file.id}`,
  );
  const title = opts.file.name;
  const contentHash = hashDocumentContent(title, content);
  const driveMs = driveModifiedMs(opts.file);

  if (existing?.aivaDocumentId) {
    const entry = await getKnowledgeEntry(opts.binding.workerId, existing.aivaDocumentId);
    if (entry) {
      const aivaHash = hashDocumentContent(entry.title, entry.content);
      const aivaMs = aivaModifiedMs(existing.updatedAtAiva) || Date.parse(entry.createdAt);
      if (aivaHash !== existing.contentHash && contentHash !== existing.contentHash) {
        // Both changed since last sync: last-writer-wins by timestamp
        if (aivaMs > driveMs) {
          return {
            result: 'skipped',
            aivaDocumentId: entry.id,
            syncStatus: existing.syncStatus,
            indexable: existing.indexable,
            driveNewer: false,
          };
        }
        await updateKnowledgeDocument({
          workerId: opts.binding.workerId,
          entryId: entry.id,
          title,
          content,
        });
        await upsertMapping({
          bindingId: opts.binding.id,
          workspaceId: opts.binding.workspaceId,
          workerId: opts.binding.workerId,
          category: opts.category,
          aivaDocumentId: entry.id,
          driveFileId: opts.file.id,
          driveWebViewLink: opts.file.webViewLink ?? existing.driveWebViewLink,
          title,
          contentHash,
          indexable,
          syncStatus: 'conflict',
          updatedAtAiva: new Date(),
          updatedAtDrive: opts.file.modifiedTime ? new Date(opts.file.modifiedTime) : new Date(),
          lastDirection: 'pull',
          meta: { conflictResolved: 'drive_wins' },
        });
        return {
          result: 'conflict',
          aivaDocumentId: entry.id,
          syncStatus: 'conflict',
          indexable,
          driveNewer: true,
        };
      }
      if (contentHash === existing.contentHash) {
        return {
          result: 'skipped',
          aivaDocumentId: entry.id,
          syncStatus: existing.syncStatus,
          indexable: existing.indexable,
          driveNewer: false,
        };
      }
      await updateKnowledgeDocument({
        workerId: opts.binding.workerId,
        entryId: entry.id,
        title,
        content,
      });
      await upsertMapping({
        bindingId: opts.binding.id,
        workspaceId: opts.binding.workspaceId,
        workerId: opts.binding.workerId,
        category: opts.category,
        aivaDocumentId: entry.id,
        driveFileId: opts.file.id,
        driveWebViewLink: opts.file.webViewLink ?? existing.driveWebViewLink,
        title,
        contentHash,
        indexable,
        syncStatus: 'synced',
        updatedAtAiva: new Date(),
        updatedAtDrive: opts.file.modifiedTime ? new Date(opts.file.modifiedTime) : new Date(),
        lastDirection: 'pull',
      });
      return {
        result: 'pulled',
        aivaDocumentId: entry.id,
        syncStatus: 'synced',
        indexable,
        driveNewer: driveMs > aivaMs,
      };
    }
  }

  let docId = existing?.aivaDocumentId ?? null;
  if (!docId) {
    const created = await insertKnowledgeDocument({
      workerId: opts.binding.workerId,
      workspaceId: opts.binding.workspaceId,
      title,
      content,
    });
    docId = created.id;
  } else {
    await updateKnowledgeDocument({
      workerId: opts.binding.workerId,
      entryId: docId,
      title,
      content,
    });
  }

  const syncStatus = indexable ? 'synced' : 'drive_only';
  await upsertMapping({
    bindingId: opts.binding.id,
    workspaceId: opts.binding.workspaceId,
    workerId: opts.binding.workerId,
    category: opts.category,
    aivaDocumentId: docId,
    driveFileId: opts.file.id,
    driveWebViewLink: opts.file.webViewLink ?? '',
    title,
    contentHash,
    indexable,
    syncStatus,
    updatedAtAiva: new Date(),
    updatedAtDrive: opts.file.modifiedTime ? new Date(opts.file.modifiedTime) : new Date(),
    lastDirection: 'pull',
  });
  return {
    result: 'pulled',
    aivaDocumentId: docId,
    syncStatus,
    indexable,
    driveNewer: false,
  };
}

async function inferCategoryForDriveFile(opts: {
  accessToken: string;
  file: DriveFileMeta;
  folders: Array<{ category: OpsCategory; folderId: string }>;
  rootFolderId: string;
}): Promise<OpsCategory> {
  let current = opts.file.parents?.[0];
  for (let depth = 0; depth < 8 && current; depth += 1) {
    const hit = opts.folders.find((f) => f.folderId === current);
    if (hit) return hit.category;
    if (current === opts.rootFolderId) return 'inbox';
    const parentFile = await getDriveFile(opts.accessToken, current);
    current = parentFile.parents?.[0];
  }
  return categoryForFolder(opts.folders, opts.file.parents?.[0]);
}

/**
 * Claim a single Drive file inside the Ops tree into an Aiva knowledge doc.
 * Always pull-through so the editor opens with current Drive content; saves write back via push.
 */
export async function claimDriveFileIntoAiva(opts: {
  workspaceId: string;
  workerId: string;
  driveFileId: string;
}): Promise<{
  aivaDocumentId: string;
  syncStatus: string;
  title: string;
  indexable: boolean;
  driveNewer: boolean;
  result: 'pulled' | 'conflict' | 'skipped';
}> {
  const binding = await getBinding(opts.workspaceId, opts.workerId);
  if (!binding?.rootFolderId) {
    throw new Error('Ops folder pack is not bootstrapped yet');
  }
  const driveFileId = opts.driveFileId.trim();
  if (!driveFileId) throw new Error('driveFileId is required');

  const accessToken = await resolveWorkerDriveToken(opts.workspaceId, opts.workerId);
  const file = await getDriveFile(accessToken, driveFileId);
  if (file.mimeType === 'application/vnd.google-apps.folder') {
    throw new Error('Cannot open a folder as a document');
  }
  if (file.trashed) throw new Error('Drive file is in trash');

  const folders = await listFolders(binding.id);
  const categoryFolderIds = folders.map((f) => f.folderId);
  const parentId = file.parents?.[0] ?? '';
  const allowed = await isFolderAllowedInOpsTree({
    accessToken,
    folderId: parentId || binding.rootFolderId,
    rootFolderId: binding.rootFolderId,
    categoryFolderIds,
  });
  if (!allowed) {
    throw new Error('File is outside the Ops Drive pack');
  }

  const category = await inferCategoryForDriveFile({
    accessToken,
    file,
    folders,
    rootFolderId: binding.rootFolderId,
  });

  const upserted = await upsertFromDriveFile({
    binding,
    accessToken,
    file,
    category,
  });
  if (!upserted.aivaDocumentId) {
    throw new Error('Claim failed: no Aiva document id');
  }
  return {
    aivaDocumentId: upserted.aivaDocumentId,
    syncStatus: upserted.syncStatus,
    title: file.name,
    indexable: upserted.indexable,
    driveNewer: upserted.driveNewer,
    result: upserted.result,
  };
}

async function pushPendingToDrive(opts: {
  binding: WorkspaceOpsBinding;
  accessToken: string;
  folders: Array<{ category: OpsCategory; folderId: string }>;
}): Promise<{ pushed: number; skipped: number }> {
  let pushed = 0;
  let skipped = 0;
  const mappings = await listMappings(opts.binding.id);
  for (const mapping of mappings) {
    if (!mapping.aivaDocumentId) {
      skipped += 1;
      continue;
    }
    if (mapping.syncStatus === 'pending' || mapping.syncStatus === 'error') {
      try {
        await pushDocumentToDrive({
          binding: opts.binding,
          accessToken: opts.accessToken,
          folders: opts.folders,
          documentId: mapping.aivaDocumentId,
          category: mapping.category,
        });
        pushed += 1;
      } catch {
        skipped += 1;
      }
    }
  }
  return { pushed, skipped };
}

export async function pushDocumentToDrive(opts: {
  binding: WorkspaceOpsBinding;
  accessToken?: string;
  folders?: Array<{ category: OpsCategory; folderId: string }>;
  documentId: string;
  category?: OpsCategory;
  trash?: boolean;
}): Promise<void> {
  const accessToken =
    opts.accessToken ??
    (await resolveWorkerDriveToken(opts.binding.workspaceId, opts.binding.workerId));
  const folders = opts.folders ?? (await listFolders(opts.binding.id));
  const entry = await getKnowledgeEntry(opts.binding.workerId, opts.documentId);
  const existing = await getMappingByDocument(opts.documentId);

  if (opts.trash || !entry) {
    if (existing?.driveFileId) {
      await trashDriveFile(accessToken, existing.driveFileId);
      await markMappingDeleted(existing.id);
    }
    return;
  }

  const category =
    opts.category && isOpsCategory(opts.category)
      ? opts.category
      : existing?.category ?? 'inbox';
  const folder = folders.find((f) => f.category === category) ?? folders.find((f) => f.category === 'inbox');
  if (!folder) throw new Error('No Ops folder bound for this category');

  const title = entry.title.slice(0, 200);
  const content = entry.content.slice(0, DOC_CHAR_LIMIT);
  const contentHash = hashDocumentContent(title, content);

  if (existing?.driveFileId) {
    await updateGoogleDocText({
      accessToken,
      documentId: existing.driveFileId,
      bodyText: content,
    });
    await upsertMapping({
      bindingId: opts.binding.id,
      workspaceId: opts.binding.workspaceId,
      workerId: opts.binding.workerId,
      category,
      aivaDocumentId: entry.id,
      driveFileId: existing.driveFileId,
      driveWebViewLink: existing.driveWebViewLink,
      title,
      contentHash,
      indexable: true,
      syncStatus: 'synced',
      updatedAtAiva: new Date(),
      updatedAtDrive: new Date(),
      lastDirection: 'push',
      lastError: null,
    });
    return;
  }

  const created = await createGoogleDoc({
    accessToken,
    title,
    parentId: folder.folderId,
    bodyText: content,
  });
  await upsertMapping({
    bindingId: opts.binding.id,
    workspaceId: opts.binding.workspaceId,
    workerId: opts.binding.workerId,
    category,
    aivaDocumentId: entry.id,
    driveFileId: created.id,
    driveWebViewLink: created.webViewLink ?? '',
    title,
    contentHash,
    indexable: true,
    syncStatus: 'synced',
    updatedAtAiva: new Date(),
    updatedAtDrive: created.modifiedTime ? new Date(created.modifiedTime) : new Date(),
    lastDirection: 'push',
    lastError: null,
  });
}

export async function markDocumentPendingAndPush(opts: {
  workspaceId: string;
  workerId: string;
  documentId: string;
  category?: OpsCategory;
}): Promise<void> {
  const binding = await getBinding(opts.workspaceId, opts.workerId);
  if (!binding?.rootFolderId) return;
  try {
    await pushDocumentToDrive({
      binding,
      documentId: opts.documentId,
      category: opts.category,
    });
  } catch (err) {
    const existing = await getMappingByDocument(opts.documentId);
    if (existing) {
      await upsertMapping({
        bindingId: binding.id,
        workspaceId: binding.workspaceId,
        workerId: binding.workerId,
        category: opts.category ?? existing.category,
        aivaDocumentId: opts.documentId,
        driveFileId: existing.driveFileId,
        driveWebViewLink: existing.driveWebViewLink,
        title: existing.title,
        contentHash: existing.contentHash,
        syncStatus: 'error',
        lastDirection: 'push',
        lastError: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
