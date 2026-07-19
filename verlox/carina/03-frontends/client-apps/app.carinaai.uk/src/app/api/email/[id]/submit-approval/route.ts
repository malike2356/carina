import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

type WorkerRow = { id?: string; name?: string; status?: string };
type GrantRow = { toolSlug?: string; status?: string };

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

/**
 * Queue a draft reply for Approvals (send only after owner approves).
 */
export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const [message] = await db
    .select()
    .from(emailMessages)
    .where(and(eq(emailMessages.id, id), eq(emailMessages.workspaceId, workspace.id)))
    .limit(1);

  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const draftBody = String(body.draftBody ?? message.aiDraftReply ?? '').trim();
  if (!draftBody) {
    return NextResponse.json(
      { error: 'Generate or write a draft reply before submitting for approval.' },
      { status: 400 },
    );
  }

  const preferredWorkerId = String(body.workerId ?? '').trim();
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
  if (!workerId) {
    for (const worker of workers) {
      const wid = String(worker.id ?? '').trim();
      if (!wid) continue;
      if (worker.status && worker.status !== 'active') continue;
      const grantsRes = await proxyAivaRequest(
        workspace.id,
        `/api/aiva/workers/${encodeURIComponent(wid)}/tools`,
        { method: 'GET' },
      );
      const grantsJson = (await grantsRes.json().catch(() => ({}))) as {
        grants?: GrantRow[];
        data?: GrantRow[];
      };
      const grants = grantsJson.grants ?? grantsJson.data ?? [];
      if (hasConnectedGmail(grants)) {
        workerId = wid;
        break;
      }
    }
  }

  if (!workerId && workers[0]?.id) workerId = String(workers[0].id);

  if (!workerId) {
    return NextResponse.json({ error: 'No Aiva worker available for approval.' }, { status: 400 });
  }

  const recipient = message.fromAddress.trim();
  const subject = /^re:/i.test(message.subject.trim())
    ? message.subject.trim()
    : `Re: ${message.subject.trim() || '(no subject)'}`;

  const createRes = await proxyAivaRequest(workspace.id, '/api/aiva/email/approvals', {
    method: 'POST',
    body: JSON.stringify({
      workerId,
      recipient,
      subject,
      draftBody,
      originalFrom: message.fromAddress,
      messageId: message.id,
      category: 'client_query',
      reviewedBy: session.user.id,
    }),
  });
  const createJson = (await createRes.json().catch(() => ({}))) as {
    error?: string;
    approval?: { id?: string };
  };

  if (!createRes.ok) {
    return NextResponse.json(
      { error: createJson.error || 'Could not create approval' },
      { status: createRes.status >= 400 ? createRes.status : 400 },
    );
  }

  await db
    .update(emailMessages)
    .set({
      aiDraftReply: draftBody,
      aiDraftGeneratedAt: new Date(),
      status: message.status === 'sent' ? message.status : 'draft_reply',
    })
    .where(eq(emailMessages.id, message.id));

  return NextResponse.json({
    ok: true,
    approvalId: createJson.approval?.id ?? null,
    approvalInboxPath: '/aiva/approvals',
  });
}
