import { NextResponse } from 'next/server';
import { upsertOutboundEmail } from '@/lib/email-outbound-store';

export const dynamic = 'force-dynamic';

/**
 * Core → app callback after gmail-send (and similar) succeeds.
 * Auth: x-internal-key === CARINA_INTERNAL_KEY
 */
export async function POST(request: Request) {
  const key = request.headers.get('x-internal-key')?.trim();
  if (!process.env.CARINA_INTERNAL_KEY || key !== process.env.CARINA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = String(body.workspaceId ?? '').trim();
  const to = String(body.to ?? body.toAddress ?? '').trim();
  const subject = String(body.subject ?? '').trim();
  const text = String(body.body ?? body.bodyFull ?? '');
  const fromAddress = String(body.fromAddress ?? body.from ?? 'Aiva via Gmail').trim()
    || 'Aiva via Gmail';
  const externalId = String(body.externalId ?? body.gmailMessageId ?? body.id ?? '').trim()
    || null;
  const sourceRaw = String(body.source ?? 'aiva').trim().toLowerCase();
  const source = sourceRaw === 'google' || sourceRaw === 'local' ? sourceRaw : 'aiva';

  if (!workspaceId || !to || !subject) {
    return NextResponse.json(
      { error: 'workspaceId, to, and subject are required' },
      { status: 400 },
    );
  }

  try {
    const result = await upsertOutboundEmail({
      workspaceId,
      fromAddress,
      toAddress: to,
      subject,
      body: text,
      externalId,
      source,
      status: 'sent',
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
