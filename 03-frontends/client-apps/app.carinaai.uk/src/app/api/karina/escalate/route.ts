import { NextResponse } from 'next/server';
import { createKarinaEscalation } from '@/lib/karina/escalate';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workspace = await requireWorkspace(session.user.id);

  const body = (await request.json().catch(() => null)) as {
    summary?: string;
    currentPage?: string;
    transcript?: Array<{ role: 'user' | 'assistant'; content: string }>;
  } | null;

  const summary = String(body?.summary ?? '').trim();
  const transcript = Array.isArray(body?.transcript) ? body!.transcript! : [];
  if (!summary && transcript.length === 0) {
    return NextResponse.json({ error: 'summary or transcript required' }, { status: 400 });
  }

  const resolvedSummary =
    summary ||
    [...transcript].reverse().find((m) => m.role === 'user')?.content?.slice(0, 240) ||
    'User requested human support from Ask Carina';

  const result = await createKarinaEscalation({
    workspaceId: workspace.id,
    userId: session.user.id,
    userEmail: session.user.email ?? 'unknown',
    userName: session.user.name,
    summary: resolvedSummary.slice(0, 1000),
    transcript: transcript.slice(-12).map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content ?? '').slice(0, 2000),
    })),
    currentPage: body?.currentPage ?? null,
  });

  return NextResponse.json({
    ok: true,
    escalationId: result.id,
    notified: {
      email: result.emailed,
      telegram: result.telegram,
    },
    message:
      result.emailed || result.telegram
        ? 'Escalated. The Aiva support team has been notified.'
        : 'Escalation logged. The team will see it in the support queue; email/Telegram notify is not fully configured yet.',
  });
}
