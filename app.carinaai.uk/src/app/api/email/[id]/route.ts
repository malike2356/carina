import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

const VALID_STATUSES = new Set(['inbox', 'archived', 'spam', 'draft_reply', 'sent']);
const VALID_URGENCIES = new Set(['low', 'normal', 'high', 'spam']);

async function getOwnedEmail(userId: string, emailId: string) {
  const workspace = await requireWorkspace(userId);
  const [message] = await db
    .select()
    .from(emailMessages)
    .where(and(eq(emailMessages.id, emailId), eq(emailMessages.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, message: message ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { message } = await getOwnedEmail(session.user.id, id);
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: message });
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { message } = await getOwnedEmail(session.user.id, id);
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await request.json()) as {
    status?: string;
    urgency?: string;
    aiDraftReply?: string;
  };
  const updates: Partial<typeof emailMessages.$inferInsert> = {};

  if (body.status != null) {
    const status = String(body.status);
    if (!VALID_STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    updates.status = status;
  }
  if (body.urgency != null) {
    const urgency = String(body.urgency);
    if (!VALID_URGENCIES.has(urgency)) {
      return NextResponse.json({ error: 'Invalid urgency' }, { status: 400 });
    }
    updates.urgency = urgency;
  }
  if (typeof body.aiDraftReply === 'string') {
    updates.aiDraftReply = body.aiDraftReply;
    updates.status = 'draft_reply';
  }

  const [updated] = await db.update(emailMessages).set(updates).where(eq(emailMessages.id, id)).returning();
  return NextResponse.json({ data: updated });
}
