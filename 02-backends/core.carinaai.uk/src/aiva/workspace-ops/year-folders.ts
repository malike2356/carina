import { createDriveFolder, resolveWorkerDriveToken } from './drive-client.js';

/** Ensure `{parent}/YYYY` year folder exists; return its Drive id. */
export async function ensureYearFolder(opts: {
  accessToken: string;
  parentFolderId: string;
  year?: string;
}): Promise<{ folderId: string; year: string }> {
  const year = opts.year ?? new Date().toISOString().slice(0, 4);
  const { listDriveChildren } = await import('./drive-client.js');
  const listed = await listDriveChildren({
    accessToken: opts.accessToken,
    folderId: opts.parentFolderId,
  });
  const existing = listed.files.find(
    (f) => f.mimeType === 'application/vnd.google-apps.folder' && f.name === year,
  );
  if (existing) return { folderId: existing.id, year };
  const created = await createDriveFolder({
    accessToken: opts.accessToken,
    name: year,
    parentId: opts.parentFolderId,
  });
  return { folderId: created.id, year };
}

export async function ensureYearFolderForWorker(opts: {
  workspaceId: string;
  workerId: string;
  parentFolderId: string;
  year?: string;
}): Promise<{ folderId: string; year: string }> {
  const accessToken = await resolveWorkerDriveToken(opts.workspaceId, opts.workerId);
  return ensureYearFolder({
    accessToken,
    parentFolderId: opts.parentFolderId,
    year: opts.year,
  });
}
