const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_CHANGES = 'https://www.googleapis.com/drive/v3/changes';
const DRIVE_CHANNELS_STOP = 'https://www.googleapis.com/drive/v3/channels/stop';

export type DriveFileMeta = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  version?: string;
  headRevisionId?: string;
  trashed?: boolean;
  parents?: string[];
  description?: string;
};

async function driveFetch(accessToken: string, url: string, init?: RequestInit): Promise<Response> {
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

export async function getStartPageToken(accessToken: string): Promise<string> {
  const res = await driveFetch(accessToken, `${DRIVE_CHANGES}/startPageToken`);
  const data = (await res.json()) as { startPageToken?: string; error?: unknown };
  if (!res.ok || !data.startPageToken) {
    throw new Error(`Drive startPageToken failed: ${JSON.stringify(data)}`);
  }
  return data.startPageToken;
}

export async function listChanges(
  accessToken: string,
  pageToken: string,
  opts: { pageSize?: number; includeRemoved?: boolean } = {},
): Promise<{
  changes: Array<{
    fileId?: string;
    removed?: boolean;
    file?: DriveFileMeta;
  }>;
  nextPageToken?: string;
  newStartPageToken?: string;
}> {
  const url = new URL(DRIVE_CHANGES);
  url.searchParams.set('pageToken', pageToken);
  url.searchParams.set('pageSize', String(opts.pageSize ?? 100));
  url.searchParams.set('includeRemoved', opts.includeRemoved === false ? 'false' : 'true');
  url.searchParams.set(
    'fields',
    'nextPageToken,newStartPageToken,changes(fileId,removed,file(id,name,mimeType,modifiedTime,version,headRevisionId,trashed,parents,description))',
  );
  // Shared Drives disabled for 711.
  url.searchParams.set('supportsAllDrives', 'false');
  url.searchParams.set('includeItemsFromAllDrives', 'false');

  const res = await driveFetch(accessToken, url.toString());
  const data = (await res.json()) as {
    changes?: Array<{ fileId?: string; removed?: boolean; file?: DriveFileMeta }>;
    nextPageToken?: string;
    newStartPageToken?: string;
    error?: unknown;
  };
  if (!res.ok) throw new Error(`Drive changes.list failed: ${JSON.stringify(data)}`);
  return {
    changes: data.changes ?? [],
    nextPageToken: data.nextPageToken,
    newStartPageToken: data.newStartPageToken,
  };
}

export async function watchChanges(opts: {
  accessToken: string;
  channelId: string;
  address: string;
  token: string;
  pageToken: string;
  expirationMs?: number;
}): Promise<{ id?: string; resourceId?: string; expiration?: string }> {
  const url = new URL(`${DRIVE_CHANGES}/watch`);
  url.searchParams.set('pageToken', opts.pageToken);
  url.searchParams.set('supportsAllDrives', 'false');
  const body = {
    id: opts.channelId,
    type: 'web_hook',
    address: opts.address,
    token: opts.token,
    expiration: opts.expirationMs,
  };
  const res = await driveFetch(opts.accessToken, url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    id?: string;
    resourceId?: string;
    expiration?: string;
    error?: unknown;
  };
  if (!res.ok) throw new Error(`Drive watch failed: ${JSON.stringify(data)}`);
  return data;
}

export async function stopChannel(
  accessToken: string,
  channelId: string,
  resourceId: string,
): Promise<void> {
  const res = await driveFetch(accessToken, DRIVE_CHANNELS_STOP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: channelId, resourceId }),
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.text().catch(() => '');
    throw new Error(`Drive stop channel failed: ${res.status} ${data.slice(0, 200)}`);
  }
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
  const res = await driveFetch(
    opts.accessToken,
    `${DRIVE_FILES}?fields=id,name,mimeType,version,modifiedTime`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json()) as DriveFileMeta & { error?: unknown };
  if (!res.ok) throw new Error(`Drive create folder failed: ${JSON.stringify(data)}`);
  return data;
}

export async function createGoogleDoc(opts: {
  accessToken: string;
  name: string;
  parentId?: string;
}): Promise<DriveFileMeta> {
  const body: Record<string, unknown> = {
    name: opts.name,
    mimeType: 'application/vnd.google-apps.document',
  };
  if (opts.parentId) body.parents = [opts.parentId];
  const res = await driveFetch(
    opts.accessToken,
    `${DRIVE_FILES}?fields=id,name,mimeType,version,modifiedTime`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  const data = (await res.json()) as DriveFileMeta & { error?: unknown };
  if (!res.ok) throw new Error(`Drive create doc failed: ${JSON.stringify(data)}`);
  return data;
}

/** Simple media upload for plain text (resumable session for larger payloads). */
export async function resumableUploadText(opts: {
  accessToken: string;
  name: string;
  mimeType: string;
  content: string;
  parentId?: string;
  fileId?: string;
}): Promise<DriveFileMeta> {
  const meta: Record<string, unknown> = {
    name: opts.name,
    mimeType: opts.mimeType,
  };
  if (opts.parentId && !opts.fileId) meta.parents = [opts.parentId];

  const initUrl = opts.fileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${opts.fileId}?uploadType=resumable&fields=id,name,mimeType,version,modifiedTime`
    : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,version,modifiedTime';

  const initRes = await driveFetch(opts.accessToken, initUrl, {
    method: opts.fileId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': opts.mimeType,
      'X-Upload-Content-Length': String(Buffer.byteLength(opts.content, 'utf8')),
    },
    body: JSON.stringify(meta),
  });
  if (!initRes.ok) {
    const err = await initRes.text().catch(() => '');
    throw new Error(`Drive resumable init failed: ${initRes.status} ${err.slice(0, 200)}`);
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) throw new Error('Drive resumable init missing Location header');

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${opts.accessToken}`,
      'Content-Type': opts.mimeType,
      'Content-Length': String(Buffer.byteLength(opts.content, 'utf8')),
    },
    body: opts.content,
    signal: AbortSignal.timeout(60000),
  });
  const data = (await putRes.json()) as DriveFileMeta & { error?: unknown };
  if (!putRes.ok) throw new Error(`Drive resumable upload failed: ${JSON.stringify(data)}`);
  return data;
}

export async function trashDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await driveFetch(accessToken, `${DRIVE_FILES}/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok && res.status !== 404) {
    const data = await res.text().catch(() => '');
    throw new Error(`Drive trash failed: ${res.status} ${data.slice(0, 200)}`);
  }
}

export function vaultKindForGoogleMime(mime: string): string {
  switch (mime) {
    case 'application/vnd.google-apps.folder':
      return 'folder';
    case 'application/vnd.google-apps.document':
      return 'rich_document';
    case 'application/vnd.google-apps.spreadsheet':
      return 'spreadsheet';
    case 'application/vnd.google-apps.presentation':
      return 'presentation';
    case 'text/markdown':
      return 'markdown';
    case 'text/html':
      return 'html';
    case 'text/plain':
      return 'plain_text';
    case 'application/pdf':
      return 'pdf';
    default:
      return 'binary_upload';
  }
}
