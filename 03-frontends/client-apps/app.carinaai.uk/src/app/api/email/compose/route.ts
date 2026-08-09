import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { upsertOutboundEmail } from '@/lib/email-outbound-store';
import { buildOutboundRawMime, type OutboundAttachment } from '@/lib/email-mime';

export const dynamic = 'force-dynamic';

type WorkerRow = { id?: string; name?: string; status?: string };
type GrantRow = { toolSlug?: string; status?: string };
type AccountGrantRow = { toolSlug?: string; status?: string };

const MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
const MAX_ATTACHMENTS = 5;

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

function parseAttachments(raw: unknown): OutboundAttachment[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: 'attachments must be an array' };
  if (raw.length > MAX_ATTACHMENTS) {
    return { error: `At most ${MAX_ATTACHMENTS} attachments allowed` };
  }

  const out: OutboundAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const filename = String(row.filename ?? '').trim();
    const mimeType = String(row.mimeType ?? 'application/octet-stream').trim();
    const contentBase64 = String(row.contentBase64 ?? '')
      .replace(/\s+/g, '')
      .trim();
    if (!filename || !contentBase64) {
      return { error: 'Each attachment needs filename and contentBase64' };
    }
    const approxBytes = Math.floor((contentBase64.length * 3) / 4);
    if (approxBytes > MAX_ATTACHMENT_BYTES) {
      return { error: `Attachment ${filename} exceeds 12MB limit` };
    }
    out.push({ filename, mimeType, contentBase64 });
  }
  return out;
}

/**
 * Compose and send from Email / Documents via a worker's connected Gmail.
 * Also writes the sent row into email_messages (source=aiva).
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const to = String(body.to ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const text = String(body.body ?? '');
  const preferredWorkerId = String(body.workerId ?? '').trim();
  const attachmentsResult = parseAttachments(body.attachments);

  if (!to || !subject) {
    return NextResponse.json({ error: 'to and subject are required' }, { status: 400 });
  }
  if ('error' in attachmentsResult) {
    return NextResponse.json({ error: attachmentsResult.error }, { status: 400 });
  }
  const attachments = attachmentsResult;

  const workersRes = await proxyAivaRequest(workspace.id, '/api/aiva/workers', { method: 'GET' });
  const workersJson = (await workersRes.json().catch(() => ({}))) as {
    data?: WorkerRow[];
    workers?: WorkerRow[];
  };
  const workers = Array.isArray(workersJson.data)
    ? workersJson.data
    : Array.isArray(workersJson.workers)
      ? workersJson.workers
      : [];

  let workerId = preferredWorkerId;
  let workerName = 'Aiva';
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
        accountGrants?: AccountGrantRow[];
      };
      const grants = [
        ...(grantsJson.grants ?? grantsJson.data ?? []),
        ...(grantsJson.accountGrants ?? []),
      ];
      if (hasConnectedGmail(grants)) {
        workerId = id;
        workerName = String(worker.name ?? 'Aiva');
        break;
      }
    }
  } else {
    const match = workers.find((w) => w.id === workerId);
    if (match?.name) workerName = String(match.name);
  }

  if (!workerId) {
    return NextResponse.json(
      { error: 'No worker with connected Gmail. Connect Gmail under Tools first.' },
      { status: 400 },
    );
  }

  const sendInput =
    attachments.length > 0
      ? {
          rawMime: buildOutboundRawMime({
            to,
            subject,
            text,
            attachments,
          }),
        }
      : { to, subject, body: text };

  const invokeRes = await proxyAivaRequest(
    workspace.id,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools/gmail/invoke`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        input: sendInput,
      }),
    },
  );
  const invokeJson = (await invokeRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    data?: { id?: string };
  };

  if (!invokeRes.ok || invokeJson.ok === false) {
    return NextResponse.json(
      { error: invokeJson.error || 'Gmail send failed' },
      { status: 400 },
    );
  }

  const gmailMessageId =
    invokeJson.data && typeof invokeJson.data.id === 'string'
      ? invokeJson.data.id
      : null;

  const attachmentNote =
    attachments.length > 0
      ? `\n\n[${attachments.length} attachment${attachments.length === 1 ? '' : 's'}: ${attachments
          .map((a) => a.filename)
          .join(', ')}]`
      : '';

  const logged = await upsertOutboundEmail({
    workspaceId: workspace.id,
    fromAddress: `${workerName} via Gmail`,
    toAddress: to,
    subject,
    body: `${text}${attachmentNote}`,
    externalId: gmailMessageId,
    source: 'aiva',
    status: 'sent',
  });

  return NextResponse.json({
    ok: true,
    id: logged.id,
    gmailMessageId,
    workerId,
    attachmentCount: attachments.length,
  });
}
