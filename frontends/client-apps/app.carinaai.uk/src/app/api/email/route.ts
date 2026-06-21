import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages, workspaceSettings } from '@/db/schema';
import { generateInboundEmailToken } from '@/lib/email-webhook';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['inbox', 'archived', 'spam', 'draft_reply', 'sent']);
const VALID_URGENCIES = new Set(['low', 'normal', 'high', 'spam']);

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
  const status = url.searchParams.get('status')?.trim();
  const urgency = url.searchParams.get('urgency')?.trim();
  const includeMeta = url.searchParams.get('meta') === '1';

  const conditions = [eq(emailMessages.workspaceId, workspace.id)];
  if (status && VALID_STATUSES.has(status)) conditions.push(eq(emailMessages.status, status));
  if (urgency && VALID_URGENCIES.has(urgency)) conditions.push(eq(emailMessages.urgency, urgency));

  const rows = await db
    .select()
    .from(emailMessages)
    .where(and(...conditions))
    .orderBy(desc(emailMessages.receivedAt))
    .limit(100);

  if (!includeMeta) {
    return NextResponse.json({ data: rows });
  }

  const token = await ensureInboundToken(workspace.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:4100';
  const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/webhooks/email/inbound?token=${token}`;

  return NextResponse.json({ data: rows, meta: { inboundWebhookUrl: webhookUrl } });
}
