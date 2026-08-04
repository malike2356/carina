import { NextResponse } from 'next/server';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { generateInboundEmailToken } from '@/lib/email-webhook';
import { getSession, requireWorkspace } from '@/lib/session';
import { buildEmailListQuery, desc, emailMessages } from '@/lib/email-query';

export const dynamic = 'force-dynamic';

async function ensureInboundToken(workspaceId: string): Promise<string> {
  const [settings] = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);

  if (settings?.inboundEmailToken) return settings.inboundEmailToken;

  const token = generateInboundEmailToken();
  if (settings) {
    await db
      .update(workspaceSettings)
      .set({ inboundEmailToken: token, updatedAt: new Date() })
      .where(eq(workspaceSettings.workspaceId, workspaceId));
  } else {
    await db.insert(workspaceSettings).values({ workspaceId, inboundEmailToken: token });
  }
  return token;
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const url = new URL(request.url);
  const includeMeta = url.searchParams.get('meta') === '1';

  const { where, limit, offset } = buildEmailListQuery({
    workspaceId: workspace.id,
    status: url.searchParams.get('status'),
    urgency: url.searchParams.get('urgency'),
    source: url.searchParams.get('source'),
    q: url.searchParams.get('q'),
    from: url.searchParams.get('from'),
    to: url.searchParams.get('to'),
    dateFrom: url.searchParams.get('dateFrom'),
    dateTo: url.searchParams.get('dateTo'),
    limit: Number(url.searchParams.get('limit') ?? 50),
    offset: Number(url.searchParams.get('offset') ?? 0),
  });

  const rows = await db
    .select()
    .from(emailMessages)
    .where(where)
    .orderBy(desc(emailMessages.receivedAt))
    .limit(limit)
    .offset(offset);

  if (!includeMeta) {
    return NextResponse.json({ data: rows, meta: { limit, offset, count: rows.length } });
  }

  const token = await ensureInboundToken(workspace.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:4100';
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/webhooks/email/inbound?token=${token}`;

  return NextResponse.json({
    data: rows,
    meta: { inboundWebhookUrl: webhookUrl, limit, offset, count: rows.length },
  });
}
