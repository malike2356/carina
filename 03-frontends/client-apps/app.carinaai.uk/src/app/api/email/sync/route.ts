import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { upsertOutboundEmail } from '@/lib/email-outbound-store';
import { extractGmailAttachments } from '@/lib/email-attachments';
import { looksLikeHtml, stripHtmlToText, emailBodyForDisplay } from '@/lib/email-text';
import { humanizeToolError } from '@/lib/humanize-tool-error';

export const dynamic = 'force-dynamic';

type WorkerRow = { id?: string; name?: string; status?: string };
type GrantRow = {
  toolSlug?: string;
  status?: string;
  lastProbeError?: string | null;
  updatedAt?: string | null;
};
type AccountGrantRow = {
  toolSlug?: string;
  status?: string;
  updatedAt?: string | null;
  lastProbeError?: string | null;
};
type MailFolder = 'inbox' | 'sent';

function isGmailSlug(slug: string): boolean {
  return slug === 'gmail' || slug === 'gmail-send';
}

function gmailGrants(grants: GrantRow[]): GrantRow[] {
  return grants.filter((g) => isGmailSlug(String(g.toolSlug ?? '').trim().toLowerCase()));
}

function hasConnectedGmail(grants: GrantRow[]): boolean {
  return gmailGrants(grants).some((g) => {
    const status = String(g.status ?? '').trim().toLowerCase();
    return status === 'connected' || status === 'ready';
  });
}

function hasGmailNeedsReauth(grants: GrantRow[]): boolean {
  return gmailGrants(grants).some((g) => {
    const status = String(g.status ?? '').trim().toLowerCase();
    return status === 'needs_reauth' || status === 'error' || status === 'disconnected';
  });
}

function bestGmailGrant(grants: GrantRow[]): GrantRow | null {
  const list = gmailGrants(grants);
  if (list.length === 0) return null;
  const rank = (status: string): number => {
    if (status === 'connected' || status === 'ready') return 0;
    if (status === 'pending_probe') return 1;
    if (status === 'needs_reauth' || status === 'error') return 2;
    return 3;
  };
  return [...list].sort((a, b) => {
    const ra = rank(String(a.status ?? '').toLowerCase());
    const rb = rank(String(b.status ?? '').toLowerCase());
    if (ra !== rb) return ra - rb;
    const ta = Date.parse(String(a.updatedAt ?? '')) || 0;
    const tb = Date.parse(String(b.updatedAt ?? '')) || 0;
    return tb - ta;
  })[0] ?? null;
}

async function loadWorkerGrants(
  workspaceId: string,
  workerId: string,
): Promise<GrantRow[]> {
  const grantsRes = await proxyAivaRequest(
    workspaceId,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools`,
    { method: 'GET' },
  );
  const grantsJson = (await grantsRes.json().catch(() => ({}))) as {
    grants?: GrantRow[];
    data?: GrantRow[];
    accountGrants?: AccountGrantRow[];
  };
  return [
    ...(grantsJson.grants ?? grantsJson.data ?? []),
    ...(grantsJson.accountGrants ?? []),
  ];
}

/** Re-probe Gmail with the existing session (heals after GCP APIs are enabled). */
async function healGmailGrant(
  workspaceId: string,
  workerId: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await proxyAivaRequest(
    workspaceId,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools`,
    {
      method: 'POST',
      body: JSON.stringify({ toolSlug: 'gmail' }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    grantStatus?: string;
    error?: string;
  };
  if (res.ok && json.ok !== false && (json.grantStatus === 'connected' || json.ok === true)) {
    return { ok: true };
  }
  return {
    ok: false,
    error: humanizeToolError(json.error ?? 'Gmail probe failed', 'Gmail'),
  };
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
  const plainChunks: string[] = [];
  const htmlChunks: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const obj = node as {
      mimeType?: string;
      body?: { data?: string };
      parts?: unknown[];
    };
    if (obj.body?.data && (obj.mimeType === 'text/plain' || obj.mimeType === 'text/html' || !obj.parts?.length)) {
      try {
        const raw = obj.body.data.replace(/-/g, '+').replace(/_/g, '/');
        const text = Buffer.from(raw, 'base64').toString('utf8');
        if (!text.trim()) {
          /* skip empty */
        } else if (obj.mimeType === 'text/html' || looksLikeHtml(text)) {
          htmlChunks.push(text);
        } else {
          plainChunks.push(text);
        }
      } catch {
        /* ignore decode errors */
      }
    }
    if (Array.isArray(obj.parts)) {
      for (const part of obj.parts) walk(part);
    }
  };
  walk(payload);
  const plain = plainChunks.join('\n\n').trim();
  if (plain) return emailBodyForDisplay(plain).slice(0, 50_000);
  const html = htmlChunks.join('\n\n').trim();
  if (html) return emailBodyForDisplay(stripHtmlToText(html) || html).slice(0, 50_000);
  return emailBodyForDisplay(snippetOf(msg));
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
    return { ok: false, error: humanizeToolError(json.error || `Gmail ${action} failed`, 'Gmail') };
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
      attachments: extractGmailAttachments(msg),
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
  const foldersRaw = (Array.isArray(body.folders) ? body.folders : ['inbox', 'sent']) as unknown[];
  const folders = foldersRaw
    .map((folder) => String(folder).trim().toLowerCase())
    .filter((folder): folder is MailFolder => folder === 'inbox' || folder === 'sent');
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

  type Candidate = {
    workerId: string;
    grant: GrantRow;
  };
  const candidates: Candidate[] = [];
  let lastReauthError: string | null = null;

  const consider = async (workerId: string) => {
    const grants = await loadWorkerGrants(workspace.id, workerId);
    const grant = bestGmailGrant(grants);
    if (!grant) return;
    const status = String(grant.status ?? '').toLowerCase();
    if (status === 'connected' || status === 'ready') {
      candidates.push({ workerId, grant });
      return;
    }
    if (status === 'needs_reauth' || status === 'error' || status === 'pending_probe' || status === 'disconnected') {
      candidates.push({ workerId, grant });
      if (grant.lastProbeError) {
        lastReauthError = humanizeToolError(grant.lastProbeError, 'Gmail');
      }
    }
  };

  if (preferredWorkerId) {
    await consider(preferredWorkerId);
  }
  for (const worker of workers) {
    const id = String(worker.id ?? '').trim();
    if (!id || id === preferredWorkerId) continue;
    if (worker.status && worker.status !== 'active') continue;
    await consider(id);
  }

  candidates.sort((a, b) => {
    const rank = (status: string): number => {
      if (status === 'connected' || status === 'ready') return 0;
      if (status === 'pending_probe') return 1;
      return 2;
    };
    const ra = rank(String(a.grant.status ?? '').toLowerCase());
    const rb = rank(String(b.grant.status ?? '').toLowerCase());
    if (ra !== rb) return ra - rb;
    const ta = Date.parse(String(a.grant.updatedAt ?? '')) || 0;
    const tb = Date.parse(String(b.grant.updatedAt ?? '')) || 0;
    return tb - ta;
  });

  let workerId = '';
  let healError: string | null = null;

  for (const candidate of candidates) {
    const status = String(candidate.grant.status ?? '').toLowerCase();
    if (status === 'connected' || status === 'ready') {
      workerId = candidate.workerId;
      break;
    }
    const healed = await healGmailGrant(workspace.id, candidate.workerId);
    if (healed.ok) {
      workerId = candidate.workerId;
      break;
    }
    healError = healed.error ?? healError;
    if (!lastReauthError && healed.error) lastReauthError = healed.error;
  }

  if (!workerId) {
    const sawNeedsReauth = candidates.length > 0;
    const gmailReconnectPath = '/aiva/tools?tool=gmail';
    return NextResponse.json(
      {
        error:
          healError
          || lastReauthError
          || (sawNeedsReauth
            ? 'Gmail access expired or was revoked. Use Reconnect Gmail in Tools, then Sync again.'
            : 'No worker with connected Gmail. Connect Gmail under Tools first.'),
        code: sawNeedsReauth ? 'gmail_needs_reauth' : 'gmail_not_connected',
        reconnectPath: gmailReconnectPath,
      },
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
    return NextResponse.json(
      {
        error: errors.join('; '),
        code: /expired|revoked|unauthorized_client|API is not enabled|reconnect/i.test(errors.join(' '))
          ? 'gmail_needs_reauth'
          : 'gmail_sync_failed',
        reconnectPath: '/aiva/tools?tool=gmail',
      },
      { status: 400 },
    );
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
