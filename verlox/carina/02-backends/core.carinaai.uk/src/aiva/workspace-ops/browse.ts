import { getDriveFile, listDriveChildren, resolveWorkerDriveToken, type DriveFileMeta } from './drive-client.js';
import { getBinding, listFolders, listMappings } from './store.js';
import type { OpsCategory, WorkspaceOpsFolder, WorkspaceOpsMapping } from './types.js';

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const MAX_PARENT_WALK = 5;

export type BrowsePathKind = 'root' | 'category' | 'folder';

export type BrowsePathCrumb = {
  folderId: string;
  name: string;
  kind: BrowsePathKind;
  category?: OpsCategory;
};

export type BrowseItemMapping = {
  aivaDocumentId: string | null;
  syncStatus: string;
  category: OpsCategory;
  origin: 'aiva' | 'google';
};

export type BrowseItem = {
  id: string;
  name: string;
  mimeType: string;
  kind: 'folder' | 'file';
  webViewLink?: string;
  modifiedTime?: string;
  mapping?: BrowseItemMapping;
};

export type BrowseResult = {
  folderId: string;
  folderName: string;
  path: BrowsePathCrumb[];
  items: BrowseItem[];
  nextPageToken?: string;
};

/** True when folderId is the Ops root, a mapped category folder, or a descendant of the root. */
export async function isFolderAllowedInOpsTree(opts: {
  accessToken: string;
  folderId: string;
  rootFolderId: string;
  categoryFolderIds: string[];
}): Promise<boolean> {
  const { folderId, rootFolderId, categoryFolderIds, accessToken } = opts;
  if (!folderId.trim()) return false;
  if (folderId === rootFolderId) return true;
  if (categoryFolderIds.includes(folderId)) return true;
  let current = folderId;
  for (let depth = 0; depth < MAX_PARENT_WALK; depth += 1) {
    const file = await getDriveFile(accessToken, current);
    const parent = file.parents?.[0];
    if (!parent) return false;
    if (parent === rootFolderId || categoryFolderIds.includes(parent)) return true;
    current = parent;
    if (current === rootFolderId) return true;
  }
  return false;
}

/** Pure allowlist helper for unit tests (no Drive calls). */
export function isFolderIdInKnownAllowlist(
  folderId: string,
  rootFolderId: string,
  categoryFolderIds: string[],
): boolean {
  return folderId === rootFolderId || categoryFolderIds.includes(folderId);
}

export function sortBrowseFiles(files: DriveFileMeta[]): DriveFileMeta[] {
  return [...files].sort((a, b) => {
    const aFolder = a.mimeType === FOLDER_MIME ? 0 : 1;
    const bFolder = b.mimeType === FOLDER_MIME ? 0 : 1;
    if (aFolder !== bFolder) return aFolder - bFolder;
    const aMonth = /^(\d{4})-(\d{2})$/.exec(a.name);
    const bMonth = /^(\d{4})-(\d{2})$/.exec(b.name);
    if (aMonth && bMonth) {
      return b.name.localeCompare(a.name);
    }
    const aYear = /^(\d{4})$/.exec(a.name);
    const bYear = /^(\d{4})$/.exec(b.name);
    if (aYear && bYear) {
      return b.name.localeCompare(a.name);
    }
    if (aMonth && !bMonth) return -1;
    if (!aMonth && bMonth) return 1;
    if (aYear && !bYear) return -1;
    if (!aYear && bYear) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

function mappingOrigin(category: OpsCategory): 'aiva' | 'google' {
  return category === 'inbox' ? 'google' : 'aiva';
}

function mappingForFile(
  fileId: string,
  byDriveId: Map<string, WorkspaceOpsMapping>,
): BrowseItemMapping | undefined {
  const m = byDriveId.get(fileId);
  if (!m) return undefined;
  return {
    aivaDocumentId: m.aivaDocumentId,
    syncStatus: m.syncStatus,
    category: m.category,
    origin: mappingOrigin(m.category),
  };
}

export function mergeBrowseItems(
  files: DriveFileMeta[],
  mappings: WorkspaceOpsMapping[],
): BrowseItem[] {
  const byDriveId = new Map(mappings.map((m) => [m.driveFileId, m]));
  return sortBrowseFiles(files).map((file) => {
    const isFolder = file.mimeType === FOLDER_MIME;
    return {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      kind: isFolder ? 'folder' : 'file',
      webViewLink: file.webViewLink,
      modifiedTime: file.modifiedTime,
      mapping: isFolder ? undefined : mappingForFile(file.id, byDriveId),
    };
  });
}

async function buildPath(opts: {
  accessToken: string;
  folderId: string;
  rootFolderId: string;
  rootFolderName: string;
  folders: WorkspaceOpsFolder[];
}): Promise<BrowsePathCrumb[]> {
  const categoryById = new Map(opts.folders.map((f) => [f.folderId, f]));
  if (opts.folderId === opts.rootFolderId) {
    return [{ folderId: opts.rootFolderId, name: opts.rootFolderName, kind: 'root' }];
  }
  const chain: Array<{ id: string; name: string }> = [];
  let current = opts.folderId;
  for (let depth = 0; depth < MAX_PARENT_WALK + 1; depth += 1) {
    const file = await getDriveFile(opts.accessToken, current);
    chain.push({ id: file.id, name: file.name });
    if (file.id === opts.rootFolderId) break;
    const parent = file.parents?.[0];
    if (!parent) break;
    if (parent === opts.rootFolderId) {
      chain.push({ id: opts.rootFolderId, name: opts.rootFolderName });
      break;
    }
    current = parent;
  }
  chain.reverse();
  if (chain[0]?.id !== opts.rootFolderId) {
    chain.unshift({ id: opts.rootFolderId, name: opts.rootFolderName });
  }
  return chain.map((crumb) => {
    if (crumb.id === opts.rootFolderId) {
      return { folderId: crumb.id, name: opts.rootFolderName, kind: 'root' };
    }
    const cat = categoryById.get(crumb.id);
    if (cat) {
      return {
        folderId: crumb.id,
        name: cat.folderName || crumb.name,
        kind: 'category',
        category: cat.category,
      };
    }
    return { folderId: crumb.id, name: crumb.name, kind: 'folder' };
  });
}

export async function browseOpsFolder(opts: {
  workspaceId: string;
  workerId: string;
  folderId?: string;
  pageToken?: string;
}): Promise<BrowseResult> {
  const binding = await getBinding(opts.workspaceId, opts.workerId);
  if (!binding?.rootFolderId) {
    throw new Error('Ops folder pack is not bootstrapped yet');
  }
  const folders = await listFolders(binding.id);
  const categoryFolderIds = folders.map((f) => f.folderId);
  const targetFolderId = (opts.folderId?.trim() || binding.rootFolderId).trim();
  const accessToken = await resolveWorkerDriveToken(opts.workspaceId, opts.workerId);
  const allowed = await isFolderAllowedInOpsTree({
    accessToken,
    folderId: targetFolderId,
    rootFolderId: binding.rootFolderId,
    categoryFolderIds,
  });
  if (!allowed) {
    throw new Error('Folder is outside the Ops Drive tree');
  }
  const listed = await listDriveChildren({
    accessToken,
    folderId: targetFolderId,
    pageToken: opts.pageToken,
  });
  const mappings = await listMappings(binding.id);
  const path = await buildPath({
    accessToken,
    folderId: targetFolderId,
    rootFolderId: binding.rootFolderId,
    rootFolderName: binding.rootFolderName || 'Ops',
    folders,
  });
  const currentName =
    path[path.length - 1]?.name
    || (targetFolderId === binding.rootFolderId ? binding.rootFolderName : 'Folder');
  return {
    folderId: targetFolderId,
    folderName: currentName || 'Folder',
    path,
    items: mergeBrowseItems(listed.files, mappings),
    nextPageToken: listed.nextPageToken,
  };
}
