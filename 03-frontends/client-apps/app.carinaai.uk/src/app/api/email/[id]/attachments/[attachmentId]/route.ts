import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import type { EmailAttachmentMeta } from '@/lib/email-attachments';
import { ensureEmailOutboundSchema } from '@/lib/email-outbound-store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };
type WorkerRow = { id?: string; name?: string; status?: string };
type GrantRow = { toolSlug?: string; status?: string };
type AccountGrantRow = { toolSlug?: string; status?: string };

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

async function findGmailWorker(workspaceId: string): Promise<string | null> {
  const workersRes = await proxyAivaRequest(workspaceId, '/api/aiva/workers', { method: 'GET' });
  const workersJson = (await workersRes.json().catch(() => ({}))) as {
    data?: WorkerRow[];
    workers?: WorkerRow[];
  };
  const workers = Array.isArray(workersJson.data)
    ? workersJson.data
    : Array.isArray(workersJson.workers)
      ? workersJson.workers
      : [];

  for (const worker of workers) {
    const id = String(worker.id ?? '').trim();
    if (!id) continue;
    if (worker.status && worker.status !== 'active') continue;
    const grantsRes = await proxyAivaRequest(
      workspaceId,
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
    if (hasConnectedGmail(grants)) return id;
  }
  return null;
}

function decodeAttachmentData(raw: string): Buffer {
  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64');
}

function contentDisposition(filename: string): string {
  const safe = filename.replace(/["\\]/g, '_').slice(0, 180) || 'attachment';
  const encoded = encodeURIComponent(filename).replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ensureEmailOutboundSchema();
  const workspace = await requireWorkspace(session.user.id);
  const { id, attachmentId: rawAttachmentId } = await context.params;
  const attachmentId = decodeURIComponent(rawAttachmentId || '').trim();
  if (!id || !attachmentId) {
    return NextResponse.json({ error: 'Missing attachment' }, { status: 400 });
  }

  const [message] = await db
    .select()
    .from(emailMessages)
    .where(and(eq(emailMessages.id, id), eq(emailMessages.workspaceId, workspace.id)))
    .limit(1);

  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const attachments = (message.attachments ?? []) as EmailAttachmentMeta[];
  const meta = attachments.find((item) => item.id === attachmentId);
  if (!meta) {
    return NextResponse.json({ error: 'Attachment not found on this message' }, { status: 404 });
  }

  const gmailMessageId = String(message.externalId ?? '').trim();
  if (!gmailMessageId || message.source !== 'google') {
    return NextResponse.json(
      { error: 'This attachment can only be downloaded from synced Google mail.' },
      { status: 400 },
    );
  }

  if (attachmentId.startsWith('inline:')) {
    return NextResponse.json(
      {
        error:
          'This small attachment was embedded in the Gmail payload. Re-sync the mailbox, or open the message in Gmail to download it.',
      },
      { status: 400 },
    );
  }

  const workerId = await findGmailWorker(workspace.id);
  if (!workerId) {
    return NextResponse.json(
      { error: 'No worker with connected Gmail. Connect Gmail under Tools first.' },
      { status: 400 },
    );
  }

  const res = await proxyAivaRequest(
    workspace.id,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools/gmail/invoke`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'get-attachment',
        input: { messageId: gmailMessageId, id: attachmentId },
      }),
    },
  );
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    data?: { data?: string; size?: number };
    error?: string;
  };

  if (!res.ok || json.ok === false || !json.data?.data) {
    return NextResponse.json(
      { error: json.error || 'Failed to fetch attachment from Gmail' },
      { status: 502 },
    );
  }

  const bytes = decodeAttachmentData(json.data.data);
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      'Content-Type': meta.mimeType || 'application/octet-stream',
      'Content-Length': String(bytes.length),
      'Content-Disposition': contentDisposition(meta.filename),
      'Cache-Control': 'private, no-store',
    },
  });
}
