import { getAccountCredentialsForWorker } from './accounts.js';
import { getToolSession, markSessionProbe, upsertToolSession } from './sessions.js';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
    || '';
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim()
    || process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
    || '';
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not configured');
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let detail = raw.slice(0, 200);
    try {
      const parsed = JSON.parse(raw) as { error?: string; error_description?: string };
      detail = [parsed.error, parsed.error_description].filter(Boolean).join(': ');
    } catch {
      /* keep raw slice */
    }
    const revoked = /invalid_grant|expired|revoked/i.test(detail);
    throw new Error(
      revoked
        ? `Google access expired or was revoked (${detail || `HTTP ${response.status}`}). Reconnect Google for this AI Employee.`
        : `Google token refresh failed HTTP ${response.status}${detail ? `: ${detail}` : ''}`,
    );
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('No access_token from Google refresh');
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + Math.max(0, data.expires_in ?? 3600) * 1000),
  };
}

async function persistRefreshedToken(opts: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  provider?: string;
  credentials: Record<string, string>;
  meta?: Record<string, unknown>;
  refreshed: { accessToken: string; expiresAt: Date };
  refreshToken: string;
}): Promise<string> {
  await upsertToolSession({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    toolSlug: opts.toolSlug,
    provider: opts.provider || 'google_workspace',
    credentials: {
      ...opts.credentials,
      access_token: opts.refreshed.accessToken,
      refresh_token: opts.refreshToken,
    },
    meta: opts.meta,
    expiresAt: opts.refreshed.expiresAt,
  });
  return opts.refreshed.accessToken;
}

export async function resolveGoogleAccessToken(opts: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
}): Promise<string> {
  const session = await getToolSession(opts.workspaceId, opts.workerId, opts.toolSlug);
  const accountCreds = await getAccountCredentialsForWorker(
    opts.workspaceId,
    opts.workerId,
    opts.toolSlug,
  ).catch(() => null);

  const credentials = {
    ...(accountCreds ?? {}),
    ...(session?.credentials ?? {}),
  };
  if (!credentials.refresh_token && !credentials.access_token) {
    throw new Error('Google OAuth session missing; connect Google Workspace for this worker');
  }
  const expiresAt = session?.expiresAt ? Date.parse(session.expiresAt) : 0;
  if (credentials.access_token && expiresAt > Date.now() + 60_000) {
    return credentials.access_token;
  }
  if (!credentials.refresh_token) {
    return credentials.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(credentials.refresh_token);
    return await persistRefreshedToken({
      workspaceId: opts.workspaceId,
      workerId: opts.workerId,
      toolSlug: opts.toolSlug,
      provider: session?.provider || 'google_workspace',
      credentials,
      meta: session?.meta,
      refreshed,
      refreshToken: credentials.refresh_token,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markSessionProbe(opts.workspaceId, opts.workerId, opts.toolSlug, false, message).catch(
      () => undefined,
    );
    throw err instanceof Error ? err : new Error(message);
  }
}

export async function invokeGoogleAction(opts: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
  action: string;
  input?: Record<string, unknown>;
}): Promise<{ ok: boolean; data: unknown; error?: string }> {
  const accessToken = await resolveGoogleAccessToken(opts);
  const headers = { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' };

  try {
    if (opts.toolSlug === 'gmail' && opts.action === 'list') {
      const q = typeof opts.input?.q === 'string' ? opts.input.q : '';
      const maxResults = Math.min(
        25,
        Math.max(1, Number(opts.input?.maxResults ?? opts.input?.limit ?? 10) || 10),
      );
      const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
      url.searchParams.set('maxResults', String(maxResults));
      if (q) url.searchParams.set('q', q);
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'gmail' && opts.action === 'get') {
      const id = String(opts.input?.id ?? opts.input?.messageId ?? '').trim();
      if (!id) return { ok: false, data: null, error: 'id required' };
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'gmail' && opts.action === 'get-attachment') {
      const messageId = String(opts.input?.messageId ?? '').trim();
      const attId = String(opts.input?.attachmentId ?? opts.input?.id ?? '').trim();
      if (!messageId || !attId) {
        return { ok: false, data: null, error: 'messageId and attachmentId (or id) required' };
      }
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attId)}`,
        { headers, signal: AbortSignal.timeout(60000) },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'gmail' && opts.action === 'send') {
      let raw = String(opts.input?.rawMime ?? '');
      if (!raw) {
        const to = String(opts.input?.to ?? '').trim();
        const subject = String(opts.input?.subject ?? '').trim();
        const body = String(opts.input?.body ?? opts.input?.text ?? '');
        if (!to || !subject) {
          return { ok: false, data: null, error: 'rawMime or to+subject required' };
        }
        const from = String(opts.input?.from ?? '').trim();
        const lines = [
          from ? `From: ${from}` : null,
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset="UTF-8"',
          '',
          body,
        ].filter((line) => line !== null);
        raw = lines.join('\r\n');
      }
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: Buffer.from(raw).toString('base64url') }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'gmail' && opts.action === 'draft') {
      const raw = String(opts.input?.rawMime ?? '');
      if (!raw) return { ok: false, data: null, error: 'rawMime required' };
      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { raw: Buffer.from(raw).toString('base64url') } }),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-calendar' && opts.action === 'list') {
      const maxResults = Math.min(
        50,
        Math.max(1, Number(opts.input?.maxResults ?? opts.input?.limit ?? 10) || 10),
      );
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('maxResults', String(maxResults));
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      const timeMin = String(opts.input?.timeMin ?? '').trim();
      const timeMax = String(opts.input?.timeMax ?? '').trim();
      url.searchParams.set('timeMin', timeMin || new Date().toISOString());
      if (timeMax) url.searchParams.set('timeMax', timeMax);
      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-calendar' && opts.action === 'create') {
      const summary = String(opts.input?.summary ?? opts.input?.title ?? '').trim();
      const start = String(opts.input?.start ?? '').trim();
      const end = String(opts.input?.end ?? '').trim();
      if (!summary || !start || !end) {
        return { ok: false, data: null, error: 'summary, start, and end required (ISO datetime)' };
      }
      const body = {
        summary,
        description: typeof opts.input?.description === 'string' ? opts.input.description : '',
        start: { dateTime: start },
        end: { dateTime: end },
        location: typeof opts.input?.location === 'string' ? opts.input.location : undefined,
        attendees: Array.isArray(opts.input?.attendees) ? opts.input.attendees : undefined,
        conferenceData: opts.input?.conferenceData && typeof opts.input.conferenceData === 'object'
          ? opts.input.conferenceData
          : undefined,
        extendedProperties: {
          private: {
            aivaManaged: 'true',
          },
        },
      };
      const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      if (body.conferenceData) url.searchParams.set('conferenceDataVersion', '1');
      const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-calendar' && opts.action === 'update') {
      const eventId = String(opts.input?.eventId ?? opts.input?.id ?? '').trim();
      if (!eventId) return { ok: false, data: null, error: 'eventId required' };
      const patch: Record<string, unknown> = {};
      if (typeof opts.input?.summary === 'string') patch.summary = opts.input.summary;
      if (typeof opts.input?.description === 'string') patch.description = opts.input.description;
      if (typeof opts.input?.start === 'string') patch.start = { dateTime: opts.input.start };
      if (typeof opts.input?.end === 'string') patch.end = { dateTime: opts.input.end };
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-calendar' && opts.action === 'delete') {
      const eventId = String(opts.input?.eventId ?? opts.input?.id ?? '').trim();
      if (!eventId) return { ok: false, data: null, error: 'eventId required' };
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
        {
          method: 'DELETE',
          headers,
          signal: AbortSignal.timeout(15000),
        },
      );
      if (res.status === 204 || res.status === 200 || res.status === 410) {
        return { ok: true, data: { deleted: true, eventId }, error: undefined };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: false, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'list') {
      const folderId = typeof opts.input?.folderId === 'string' ? opts.input.folderId : '';
      const q = folderId
        ? `'${folderId}' in parents and trashed = false`
        : 'trashed = false';
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', q);
      url.searchParams.set('pageSize', '25');
      url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,parents)');
      url.searchParams.set('corpora', 'allDrives');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      url.searchParams.set('supportsAllDrives', 'true');
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'search') {
      const rawQuery = String(opts.input?.query ?? opts.input?.q ?? '').trim();
      if (!rawQuery) return { ok: false, data: null, error: 'query required' };
      const escaped = rawQuery.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const pageSize = Math.min(
        25,
        Math.max(1, Number(opts.input?.pageSize ?? opts.input?.limit ?? 10) || 10),
      );
      const q =
        `(name contains '${escaped}' or fullText contains '${escaped}') and trashed = false`;
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('q', q);
      url.searchParams.set('pageSize', String(pageSize));
      url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,parents)');
      url.searchParams.set('corpora', 'allDrives');
      url.searchParams.set('includeItemsFromAllDrives', 'true');
      url.searchParams.set('supportsAllDrives', 'true');
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-drive' && (opts.action === 'upload' || opts.action === 'create')) {
      const { createGoogleDoc, createDriveFolder } = await import('../../aiva/workspace-ops/drive-client.js');
      const title = String(opts.input?.title ?? opts.input?.name ?? 'Untitled').trim();
      const parentId = String(opts.input?.parentId ?? opts.input?.folderId ?? '').trim();
      const mime = String(opts.input?.mimeType ?? 'application/vnd.google-apps.document');
      const bodyText = String(opts.input?.content ?? opts.input?.body ?? '');
      if (!parentId) return { ok: false, data: null, error: 'parentId (folder) is required' };
      if (mime.includes('folder')) {
        const folder = await createDriveFolder({ accessToken, name: title, parentId });
        return { ok: true, data: folder };
      }
      const doc = await createGoogleDoc({ accessToken, title, parentId, bodyText });
      return { ok: true, data: doc };
    }
    if (opts.toolSlug === 'google-drive' && (opts.action === 'read' || opts.action === 'export')) {
      const { getDriveFile, exportDriveFileText } = await import('../../aiva/workspace-ops/drive-client.js');
      const fileId = String(opts.input?.fileId ?? opts.input?.id ?? '').trim();
      if (!fileId) return { ok: false, data: null, error: 'fileId is required' };
      const file = await getDriveFile(accessToken, fileId);
      const text = await exportDriveFileText(accessToken, file);
      return { ok: true, data: { file, text, indexable: text != null } };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'update') {
      const { updateGoogleDocText } = await import('../../aiva/workspace-ops/drive-client.js');
      const fileId = String(opts.input?.fileId ?? opts.input?.id ?? '').trim();
      const bodyText = String(opts.input?.content ?? opts.input?.body ?? '');
      if (!fileId) return { ok: false, data: null, error: 'fileId is required' };
      await updateGoogleDocText({ accessToken, documentId: fileId, bodyText });
      return { ok: true, data: { id: fileId, updated: true } };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'move') {
      const fileId = String(opts.input?.fileId ?? opts.input?.id ?? '').trim();
      const parentId = String(opts.input?.parentId ?? opts.input?.folderId ?? '').trim();
      if (!fileId || !parentId) {
        return { ok: false, data: null, error: 'fileId and parentId (destination folder) required' };
      }
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=parents&supportsAllDrives=true`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      const meta = (await metaRes.json()) as { parents?: string[] };
      if (!metaRes.ok) {
        return { ok: false, data: meta, error: JSON.stringify(meta) };
      }
      const previous = (meta.parents ?? []).join(',');
      const url = new URL(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      );
      url.searchParams.set('addParents', parentId);
      if (previous) url.searchParams.set('removeParents', previous);
      url.searchParams.set('supportsAllDrives', 'true');
      url.searchParams.set('fields', 'id,name,parents,webViewLink');
      const res = await fetch(url.toString(), {
        method: 'PATCH',
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'delete') {
      const fileId = String(opts.input?.fileId ?? opts.input?.id ?? '').trim();
      if (!fileId) return { ok: false, data: null, error: 'fileId is required' };
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
        { method: 'DELETE', headers, signal: AbortSignal.timeout(15000) },
      );
      if (res.status === 204 || res.ok) {
        return { ok: true, data: { id: fileId, deleted: true } };
      }
      const data = await res.json().catch(() => ({ status: res.status }));
      return { ok: false, data, error: JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-drive' && opts.action === 'share') {
      const fileId = String(opts.input?.fileId ?? opts.input?.id ?? '').trim();
      const email = String(opts.input?.email ?? opts.input?.to ?? '').trim();
      const role = String(opts.input?.role ?? 'reader').trim() || 'reader';
      if (!fileId || !email) {
        return { ok: false, data: null, error: 'fileId and email required' };
      }
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=true`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'user',
            role: ['reader', 'writer', 'commenter'].includes(role) ? role : 'reader',
            emailAddress: email,
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-tasks' && opts.action === 'list') {
      const tasklist = String(opts.input?.tasklist ?? opts.input?.taskListId ?? '@default').trim() || '@default';
      const maxResults = Math.min(
        100,
        Math.max(1, Number(opts.input?.maxResults ?? opts.input?.limit ?? 20) || 20),
      );
      const url = new URL(
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tasklist)}/tasks`,
      );
      url.searchParams.set('maxResults', String(maxResults));
      url.searchParams.set('showCompleted', String(opts.input?.showCompleted !== false));
      url.searchParams.set('showHidden', 'false');
      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(15000) });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-tasks' && opts.action === 'list-lists') {
      const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-tasks' && opts.action === 'create') {
      const title = String(opts.input?.title ?? opts.input?.name ?? '').trim();
      if (!title) return { ok: false, data: null, error: 'title required' };
      const tasklist = String(opts.input?.tasklist ?? opts.input?.taskListId ?? '@default').trim() || '@default';
      const body: Record<string, unknown> = { title };
      if (typeof opts.input?.notes === 'string') body.notes = opts.input.notes;
      if (typeof opts.input?.due === 'string' && opts.input.due.trim()) {
        body.due = opts.input.due.trim();
      }
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tasklist)}/tasks`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-tasks' && (opts.action === 'complete' || opts.action === 'update')) {
      const taskId = String(opts.input?.taskId ?? opts.input?.id ?? '').trim();
      if (!taskId) return { ok: false, data: null, error: 'taskId required' };
      const tasklist = String(opts.input?.tasklist ?? opts.input?.taskListId ?? '@default').trim() || '@default';
      const patch: Record<string, unknown> = {};
      if (opts.action === 'complete' || opts.input?.status === 'completed') {
        patch.status = 'completed';
      }
      if (typeof opts.input?.title === 'string') patch.title = opts.input.title;
      if (typeof opts.input?.notes === 'string') patch.notes = opts.input.notes;
      if (typeof opts.input?.status === 'string') patch.status = opts.input.status;
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/${encodeURIComponent(tasklist)}/tasks/${encodeURIComponent(taskId)}`,
        {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-sheets' && (opts.action === 'read' || opts.action === 'list')) {
      // Probe uses spreadsheets endpoint; list spreadsheets via Drive query when no spreadsheetId
      const spreadsheetId = typeof opts.input?.spreadsheetId === 'string' ? opts.input.spreadsheetId : '';
      if (!spreadsheetId) {
        const res = await fetch(
          "https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.spreadsheet'&pageSize=5&fields=files(id,name)",
          { headers, signal: AbortSignal.timeout(15000) },
        );
        const data = await res.json();
        return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
      }
      const range = typeof opts.input?.range === 'string' ? opts.input.range : 'A1:D10';
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
        { headers, signal: AbortSignal.timeout(15000) },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-sheets' && opts.action === 'create') {
      const title = String(opts.input?.title ?? 'Untitled spreadsheet').trim() || 'Untitled spreadsheet';
      const values = Array.isArray(opts.input?.values) ? opts.input.values : null;
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: 'Leads' } }],
        }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json() as Record<string, unknown>;
      if (!res.ok) return { ok: false, data, error: JSON.stringify(data) };
      const spreadsheetId = String(data.spreadsheetId ?? '');
      if (spreadsheetId && values && values.length > 0) {
        const appendRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent('Leads!A1')}:append?valueInputOption=USER_ENTERED`,
          {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values }),
            signal: AbortSignal.timeout(20000),
          },
        );
        const appendData = await appendRes.json();
        return {
          ok: appendRes.ok,
          data: {
            spreadsheetId,
            spreadsheetUrl: data.spreadsheetUrl,
            properties: data.properties,
            append: appendData,
          },
          error: appendRes.ok ? undefined : JSON.stringify(appendData),
        };
      }
      return {
        ok: true,
        data: {
          spreadsheetId,
          spreadsheetUrl: data.spreadsheetUrl,
          properties: data.properties,
        },
      };
    }
    if (opts.toolSlug === 'google-sheets' && opts.action === 'append') {
      const spreadsheetId = String(opts.input?.spreadsheetId ?? '').trim();
      const range = String(opts.input?.range ?? 'A1').trim();
      const values = Array.isArray(opts.input?.values) ? opts.input.values : null;
      if (!spreadsheetId || !values) {
        return { ok: false, data: null, error: 'spreadsheetId and values[] required' };
      }
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values }),
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.toolSlug === 'google-contacts' && (opts.action === 'list' || opts.action === 'search')) {
      const pageSize = Math.min(Math.max(Number(opts.input?.pageSize) || 10, 1), 50);
      const query = String(opts.input?.query ?? opts.input?.q ?? '').trim();
      if (opts.action === 'search' && query) {
        // Prefer the synced Contacts directory (same store as the Contacts page).
        // Google people:searchContacts often misses partial names that exist locally.
        try {
          const { findContact } = await import('../../profiles/contacts.js');
          const local = await findContact(query, opts.workspaceId);
          if (local.length > 0) {
            return {
              ok: true,
              data: {
                source: 'synced_contacts_directory',
                query,
                count: local.length,
                results: local.slice(0, pageSize).map((c) => ({
                  name: c.name,
                  phone: c.phone,
                  email: c.email,
                  role: c.role,
                  source: c.source,
                })),
              },
            };
          }
        } catch {
          // fall through to People API
        }
        const url = new URL('https://people.googleapis.com/v1/people:searchContacts');
        url.searchParams.set('query', query);
        url.searchParams.set('readMask', 'names,emailAddresses,phoneNumbers,organizations');
        url.searchParams.set('pageSize', String(pageSize));
        const res = await fetch(url.toString(), {
          headers,
          signal: AbortSignal.timeout(15000),
        });
        const data = await res.json();
        if (res.ok) {
          const results = Array.isArray((data as { results?: unknown[] }).results)
            ? (data as { results: unknown[] }).results
            : [];
          if (results.length === 0) {
            return {
              ok: true,
              data: {
                ...data,
                source: 'google_people_api',
                query,
                count: 0,
                note:
                  'People API returned no matches. Also searched the synced Contacts directory with no hits. '
                  + 'Try contacts(action="search") or a shorter name token, then Resync Google on the Contacts page.',
              },
            };
          }
        }
        return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
      }
      const url = new URL('https://people.googleapis.com/v1/people/me/connections');
      url.searchParams.set('personFields', 'names,emailAddresses,phoneNumbers,organizations');
      url.searchParams.set('pageSize', String(pageSize));
      const res = await fetch(url.toString(), {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    if (opts.action === 'list' || opts.action === 'read') {
      // generic google probe fallback via Drive about
      const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers,
        signal: AbortSignal.timeout(15000),
      });
      const data = await res.json();
      return { ok: res.ok, data, error: res.ok ? undefined : JSON.stringify(data) };
    }
    return { ok: false, data: null, error: `Unsupported Google action ${opts.toolSlug}.${opts.action}` };
  } catch (err) {
    return { ok: false, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}
