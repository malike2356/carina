import { getToolSession, upsertToolSession } from './sessions.js';

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
    throw new Error(`Google token refresh failed HTTP ${response.status}`);
  }
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('No access_token from Google refresh');
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + Math.max(0, data.expires_in ?? 3600) * 1000),
  };
}

export async function resolveGoogleAccessToken(opts: {
  workspaceId: string;
  workerId: string;
  toolSlug: string;
}): Promise<string> {
  const session = await getToolSession(opts.workspaceId, opts.workerId, opts.toolSlug);
  if (!session?.credentials.refresh_token && !session?.credentials.access_token) {
    throw new Error('Google OAuth session missing; connect Google Workspace for this worker');
  }
  const expiresAt = session.expiresAt ? Date.parse(session.expiresAt) : 0;
  if (session.credentials.access_token && expiresAt > Date.now() + 60_000) {
    return session.credentials.access_token;
  }
  if (!session.credentials.refresh_token) {
    return session.credentials.access_token;
  }
  const refreshed = await refreshAccessToken(session.credentials.refresh_token);
  await upsertToolSession({
    workspaceId: opts.workspaceId,
    workerId: opts.workerId,
    toolSlug: opts.toolSlug,
    provider: 'google_workspace',
    credentials: {
      ...session.credentials,
      access_token: refreshed.accessToken,
      refresh_token: session.credentials.refresh_token,
    },
    meta: session.meta,
    expiresAt: refreshed.expiresAt,
  });
  return refreshed.accessToken;
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
      const res = await fetch(
        'https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=10&singleEvents=true&orderBy=startTime',
        { headers, signal: AbortSignal.timeout(15000) },
      );
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
      };
      const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
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
