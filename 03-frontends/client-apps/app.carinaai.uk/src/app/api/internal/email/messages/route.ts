import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import { buildEmailListQuery, desc } from '@/lib/email-query';

export const dynamic = 'force-dynamic';

/**
 * Core → app: agents list/get synced Email page messages.
 * Auth: x-internal-key === CARINA_INTERNAL_KEY
 */
export async function GET(request: Request) {
  const key = request.headers.get('x-internal-key')?.trim();
  if (!process.env.CARINA_INTERNAL_KEY || key !== process.env.CARINA_INTERNAL_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  const id = url.searchParams.get('id')?.trim() ?? '';

  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  if (id) {
    const [row] = await db
      .select()
      .from(emailMessages)
      .where(and(eq(emailMessages.id, id), eq(emailMessages.workspaceId, workspaceId)))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ data: row });
  }

  const { where, limit, offset } = buildEmailListQuery({
    workspaceId,
    status: url.searchParams.get('status'),
    urgency: url.searchParams.get('urgency'),
    source: url.searchParams.get('source'),
    q: url.searchParams.get('q'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
    limit: Number(url.searchParams.get('limit') ?? 20),
    offset: Number(url.searchParams.get('offset') ?? 0),
  });

  const rows = await db
    .select()
    .from(emailMessages)
    .where(where)
    .orderBy(desc(emailMessages.receivedAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    data: rows.map((row) => ({
      id: row.id,
      fromAddress: row.fromAddress,
      toAddress: row.toAddress,
      subject: row.subject,
      bodyPreview: row.bodyPreview,
      source: row.source,
      status: row.status,
      urgency: row.urgency,
      receivedAt: row.receivedAt,
      externalId: row.externalId,
      hasDraft: Boolean(row.aiDraftReply?.trim()),
    })),
    meta: { limit, offset, count: rows.length },
  });
}

/**
 * Core → app: store hosted inbound (or other agent) email into the workspace Email page.
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

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const fromAddress = typeof body.fromAddress === 'string' ? body.fromAddress.trim() : '';
  if (!workspaceId || !fromAddress) {
    return NextResponse.json({ error: 'workspaceId and fromAddress required' }, { status: 400 });
  }

  const subject =
    typeof body.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : '(no subject)';
  const bodyFull =
    typeof body.bodyFull === 'string'
      ? body.bodyFull
      : typeof body.bodyPreview === 'string'
        ? body.bodyPreview
        : '';
  const bodyPreview =
    typeof body.bodyPreview === 'string'
      ? body.bodyPreview.slice(0, 500)
      : bodyFull.slice(0, 500);

  const [created] = await db
    .insert(emailMessages)
    .values({
      workspaceId,
      externalId: typeof body.externalId === 'string' ? body.externalId : null,
      fromAddress,
      toAddress: typeof body.toAddress === 'string' ? body.toAddress : null,
      source:
        typeof body.source === 'string' && body.source.trim()
          ? body.source.trim().slice(0, 30)
          : 'aiva-hosted',
      subject,
      bodyPreview,
      bodyFull,
      urgency:
        typeof body.urgency === 'string' && body.urgency.trim()
          ? body.urgency.trim().slice(0, 20)
          : 'normal',
      status:
        typeof body.status === 'string' && body.status.trim()
          ? body.status.trim().slice(0, 30)
          : 'inbox',
    })
    .returning();

  return NextResponse.json({ ok: true, id: created.id });
}
