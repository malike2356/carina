import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { upsertOutboundEmail } from '@/lib/email-outbound-store';

export const dynamic = 'force-dynamic';

type WorkerRow = { id?: string; name?: string; status?: string };
type GrantRow = { toolSlug?: string; status?: string };
type MailFolder = 'inbox' | 'sent';

function hasConnectedGmail(grants: GrantRow[]): boolean {
  return grants.some((g) => {
    const slug = String(g.toolSlug ?? '').trim().toLowerCase();
    const status = String(g.status ?? '').trim().toLowerCase();
    return (
      (slug === 'gmail' || slug === 'gmail-send')
      && (status === 'connected' || status === 'ready')
    );
  });
}

function headerMap(payload: unknown): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!payload || typeof payload !== 'object') return headers;
  const list = (payload as { headers?: Array<{ name?: string; value?: string }> }).headers;
  if (!Array.isArray(list)) return headers;
  for (const item of list) {
    const name = String(item?.name ?? '').trim().toLowerCase();
    const value = String(item?.value ?? '').trim();
    if (name && value) headers[name] = value;
  }
  return headers;
}

function snippetOf(msg: unknown): string {
  if (!msg || typeof msg !== 'object') return '';
  const snippet = (msg as { snippet?: string }).snippet;
  return typeof snippet === 'string' ? snippet : '';
}

function decodeBodyText(msg: unknown): string {
  if (!msg || typeof msg !== 'object') return '';
  const payload = (msg as { payload?: unknown }).payload;
  const chunks: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as {
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
    if (obj.body?.data && (obj.mimeType === 'text/plain' || !obj.parts?.length)) {
      try {
        const raw = obj.body.data.replace(/-/g, '+').replace(/_/g, '/');
        const text = Buffer.from(raw, 'base64').toString('utf8');
        if (text.trim()) chunks.push(text);
      } catch {
        /* ignore decode errors */
      }
    }
    if (Array.isArray(obj.parts)) {
      for (const part of obj.parts) walk(part);
    }
  };
  walk(payload);
  const joined = chunks.join('\n\n').trim();
  if (joined) return joined.slice(0, 50_000);
  return snippetOf(msg);
}

async function invokeGmail(
  workspaceId: string,
  workerId: string,
  action: string,
  input?: Record<string, unknown>,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const res = await proxyAivaRequest(
    workspaceId,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools/gmail/invoke`,
    {
      method: 'POST',
      body: JSON.stringify({ action, input }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: unknown;
    error?: string;
  };
  if (!res.ok || json.ok === false) {
    return { ok: false, error: json.error || `Gmail ${action} failed` };
  }
  return { ok: true, data: json.data };
}

async function syncGmailFolder(input: {
  workspaceId: string;
  workerId: string;
  folder: MailFolder;
  maxMessages: number;
}): Promise<{ imported: number; updated: number; scanned: number; error?: string }> {
  const q = input.folder === 'sent' ? 'in:sent' : 'in:inbox';
  const status = input.folder === 'sent' ? 'sent' : 'inbox';

  const listed = await invokeGmail(input.workspaceId, input.workerId, 'list', {
    q,
    maxResults: input.maxMessages,
  });
  if (!listed.ok) {
    return {
      imported: 0,
      updated: 0,
      scanned: 0,
      error: listed.error || `Gmail ${input.folder} list failed`,
    };
  }

  const rawMessages = (listed.data as { messages?: Array<{ id?: string }> } | null)?.messages ?? [];
  const ids = rawMessages
    .map((m) => String(m.id ?? '').trim())
    .filter(Boolean)
    .slice(0, input.maxMessages);

  let imported = 0;
  let updated = 0;
  for (const id of ids) {
    const got = await invokeGmail(input.workspaceId, input.workerId, 'get', { id });
    if (!got.ok || !got.data) continue;
    const msg = got.data;
    const headers = headerMap(
      msg && typeof msg === 'object' ? (msg as { payload?: unknown }).payload : null,
    );
    const result = await upsertOutboundEmail({
      workspaceId: input.workspaceId,
      fromAddress: headers.from || 'me',
      toAddress: headers.to || null,
      subject: headers.subject || '(no subject)',
      body: decodeBodyText(msg),
      externalId: id,
      source: 'google',
      status,
      receivedAt: headers.date ? new Date(headers.date) : new Date(),
    });
    if (result.created) imported += 1;
    else updated += 1;
  }

  return { imported, updated, scanned: ids.length };
}

/**
 * Pull recent Gmail Inbox + Sent into email_messages (source=google).
 * Agent-sent rows with the same Gmail id keep source=aiva.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const maxMessages = Math.min(25, Math.max(1, Number(body.limit ?? 15)));
  const preferredWorkerId = String(body.workerId ?? '').trim();
  const foldersRaw = Array.isArray(body.folders) ? body.folders : ['inbox', 'sent'];
  const folders = foldersRaw
    .map((f) => String(f).trim().toLowerCase())
    .filter((f): f is MailFolder => f === 'inbox' || f === 'sent');
  const foldersToSync: MailFolder[] = folders.length > 0 ? folders : ['inbox', 'sent'];

  const workersRes = await proxyAivaRequest(workspace.id, '/api/aiva/workers', { method: 'GET' });
  const workersJson = (await workersRes.json().catch(() => ({}))) as {
    data?: WorkerRow[];
    workers?: WorkerRow[];
  };
  const workers = Array.isArray(workersJson.data)
    ? workersJson.data
    : Array.isArray(workersJson.workers)
      ? workersJson.workers
      : Array.isArray(workersJson)
        ? (workersJson as WorkerRow[])
        : [];

  if (!workersRes.ok || workers.length === 0) {
    return NextResponse.json(
      { error: 'No Aiva workers found for this workspace.' },
      { status: 400 },
    );
  }

  let workerId = preferredWorkerId;
  if (!workerId) {
    for (const worker of workers) {
      const id = String(worker.id ?? '').trim();
      if (!id) continue;
      if (worker.status && worker.status !== 'active') continue;
      const grantsRes = await proxyAivaRequest(
        workspace.id,
        `/api/aiva/workers/${encodeURIComponent(id)}/tools`,
        { method: 'GET' },
      );
      const grantsJson = (await grantsRes.json().catch(() => ({}))) as {
        grants?: GrantRow[];
        data?: GrantRow[];
      };
      const grants = grantsJson.grants ?? grantsJson.data ?? [];
      if (hasConnectedGmail(grants)) {
        workerId = id;
        break;
      }
    }
  }

  if (!workerId) {
    return NextResponse.json(
      { error: 'No worker with connected Gmail. Connect Gmail under Tools first.' },
      { status: 400 },
    );
  }

  const byFolder: Record<string, { imported: number; updated: number; scanned: number }> = {};
  let imported = 0;
  let updated = 0;
  let scanned = 0;
  const errors: string[] = [];

  for (const folder of foldersToSync) {
    const result = await syncGmailFolder({
      workspaceId: workspace.id,
      workerId,
      folder,
      maxMessages,
    });
    byFolder[folder] = {
      imported: result.imported,
      updated: result.updated,
      scanned: result.scanned,
    };
    imported += result.imported;
    updated += result.updated;
    scanned += result.scanned;
    if (result.error) errors.push(result.error);
  }

  if (scanned === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors.join('; ') }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    workerId,
    imported,
    updated,
    scanned,
    folders: byFolder,
    warnings: errors.length > 0 ? errors : undefined,
    syncedAt: new Date().toISOString(),
  });
}
