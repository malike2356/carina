import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { proxyAivaRequest } from '@/lib/aiva-proxy';
import { upsertOutboundEmail } from '@/lib/email-outbound-store';

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
 * Compose and send from the Email page via a worker's connected Gmail.
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

  if (!to || !subject) {
    return NextResponse.json({ error: 'to and subject are required' }, { status: 400 });
  }

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
      };
      const grants = grantsJson.grants ?? grantsJson.data ?? [];
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

  const invokeRes = await proxyAivaRequest(
    workspace.id,
    `/api/aiva/workers/${encodeURIComponent(workerId)}/tools/gmail/invoke`,
    {
      method: 'POST',
      body: JSON.stringify({
        action: 'send',
        input: { to, subject, body: text },
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

  const logged = await upsertOutboundEmail({
    workspaceId: workspace.id,
    fromAddress: `${workerName} via Gmail`,
    toAddress: to,
    subject,
    body: text,
    externalId: gmailMessageId,
    source: 'aiva',
    status: 'sent',
  });

  return NextResponse.json({
    ok: true,
    id: logged.id,
    gmailMessageId,
    workerId,
  });
}
