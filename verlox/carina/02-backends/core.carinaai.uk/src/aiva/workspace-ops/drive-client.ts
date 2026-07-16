import { resolveGoogleAccessToken } from '../../workers/product-tools/google-driver.js';

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DOCS_EXPORT = 'https://docs.googleapis.com/v1/documents';

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  trashed?: boolean;
  parents?: string[];
};

async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(30000),
  });
}

export async function createDriveFolder(opts: {
  accessToken: string;
  name: string;
  parentId?: string;
}): Promise<DriveFileMeta> {
  const body: Record<string, unknown> = {
    name: opts.name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (opts.parentId) body.parents = [opts.parentId];
  const res = await driveFetch(opts.accessToken, `${DRIVE_FILES}?fields=id,name,mimeType,webViewLink`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as DriveFileMeta & { error?: unknown };
  if (!res.ok) throw new Error(`Drive create folder failed: ${JSON.stringify(data)}`);
  return data;
}

export async function listDriveChildren(opts: {
  accessToken: string;
  folderId: string;
  pageToken?: string;
}): Promise<{ files: DriveFileMeta[]; nextPageToken?: string }> {
  const q = `'${opts.folderId}' in parents and trashed = false`;
  const url = new URL(DRIVE_FILES);
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', '100');
  url.searchParams.set(
    'fields',
    'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,trashed,parents)',
  );
  if (opts.pageToken) url.searchParams.set('pageToken', opts.pageToken);
  const res = await driveFetch(opts.accessToken, url.toString());
  const data = (await res.json()) as {
    files?: DriveFileMeta[];
    nextPageToken?: string;
    error?: unknown;
  };
  if (!res.ok) throw new Error(`Drive list failed: ${JSON.stringify(data)}`);
  return { files: data.files ?? [], nextPageToken: data.nextPageToken };
}

export async function getDriveFile(
  accessToken: string,
  fileId: string,
): Promise<DriveFileMeta> {
  const url = `${DRIVE_FILES}/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,webViewLink,trashed,parents`;
  const res = await driveFetch(accessToken, url);
  const data = (await res.json()) as DriveFileMeta & { error?: unknown };
  if (!res.ok) throw new Error(`Drive get file failed: ${JSON.stringify(data)}`);
  return data;
}

/** Export Docs/Sheets/text to plain text. Unsupported types return null. */
export async function exportDriveFileText(
  accessToken: string,
  file: DriveFileMeta,
): Promise<string | null> {
  if (file.mimeType === 'application/vnd.google-apps.document') {
    const res = await driveFetch(
      accessToken,
      `${DRIVE_FILES}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent('text/plain')}`,
    );
    if (!res.ok) throw new Error(`Drive Doc export failed HTTP ${res.status}`);
    return await res.text();
  }
  if (file.mimeType === 'application/vnd.google-apps.spreadsheet') {
    const res = await driveFetch(
      accessToken,
      `${DRIVE_FILES}/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent('text/csv')}`,
    );
    if (!res.ok) throw new Error(`Drive Sheet export failed HTTP ${res.status}`);
    return await res.text();
  }
  if (
    file.mimeType === 'text/plain' ||
    file.mimeType === 'text/markdown' ||
    file.mimeType === 'text/csv'
  ) {
    const res = await driveFetch(
      accessToken,
      `${DRIVE_FILES}/${encodeURIComponent(file.id)}?alt=media`,
    );
    if (!res.ok) throw new Error(`Drive media download failed HTTP ${res.status}`);
    return await res.text();
  }
  return null;
}

export async function createGoogleDoc(opts: {
  accessToken: string;
  title: string;
  parentId: string;
  bodyText: string;
}): Promise<DriveFileMeta> {
  const metaRes = await driveFetch(
    opts.accessToken,
    `${DRIVE_FILES}?fields=id,name,mimeType,modifiedTime,webViewLink,parents`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: opts.title,
        mimeType: 'application/vnd.google-apps.document',
        parents: [opts.parentId],
      }),
    },
  );
  const meta = (await metaRes.json()) as DriveFileMeta & { error?: unknown };
  if (!metaRes.ok) throw new Error(`Drive create Doc failed: ${JSON.stringify(meta)}`);

  if (opts.bodyText.trim()) {
    await updateGoogleDocText({
      accessToken: opts.accessToken,
      documentId: meta.id,
      bodyText: opts.bodyText,
    });
  }
  return getDriveFile(opts.accessToken, meta.id);
}

export async function updateGoogleDocText(opts: {
  accessToken: string;
  documentId: string;
  bodyText: string;
}): Promise<void> {
  const getRes = await driveFetch(
    opts.accessToken,
    `${DOCS_EXPORT}/${encodeURIComponent(opts.documentId)}`,
  );
  const doc = (await getRes.json()) as {
    body?: { content?: Array<{ endIndex?: number }> };
    error?: unknown;
  };
  if (!getRes.ok) throw new Error(`Docs get failed: ${JSON.stringify(doc)}`);

  const endIndex =
    doc.body?.content?.reduce((max, el) => Math.max(max, el.endIndex ?? 0), 1) ?? 1;
  const requests: unknown[] = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: 1, endIndex: endIndex - 1 },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1 },
      text: opts.bodyText || ' ',
    },
  });

  const updateRes = await driveFetch(
    opts.accessToken,
    `${DOCS_EXPORT}/${encodeURIComponent(opts.documentId)}:batchUpdate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests }),
    },
  );
  if (!updateRes.ok) {
    const err = await updateRes.text();
    throw new Error(`Docs batchUpdate failed: ${err}`);
  }
}

export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await driveFetch(accessToken, `${DRIVE_FILES}/${encodeURIComponent(fileId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive trash failed: ${err}`);
  }
}

export async function resolveWorkerDriveToken(
  workspaceId: string,
  workerId: string,
): Promise<string> {
  return resolveGoogleAccessToken({
    workspaceId,
    workerId,
    toolSlug: 'google-drive',
  });
}
