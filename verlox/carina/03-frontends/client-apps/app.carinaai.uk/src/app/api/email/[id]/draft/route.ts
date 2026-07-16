import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { emailMessages } from '@/db/schema';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import { completeWorkspacePrompt } from '@/lib/workspace-llm';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const workspace = await requireWorkspace(session.user.id);
  const [message] = await db
    .select()
    .from(emailMessages)
    .where(and(eq(emailMessages.id, id), eq(emailMessages.workspaceId, workspace.id)))
    .limit(1);

  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const keys = await getDecryptedWorkspaceKeys(workspace.id);
  if (keys.length === 0) {
    return NextResponse.json({ error: 'No API keys configured' }, { status: 400 });
  }

  const prompt = `Draft a professional email reply to this message.

From: ${message.fromAddress}
Subject: ${message.subject || '(no subject)'}
Body:
${(message.bodyFull ?? message.bodyPreview ?? '').slice(0, 3000)}

Output ONLY the reply body text. No subject line, no salutation unless natural, no signature.`;

  try {
    const draft = await completeWorkspacePrompt(
      keys,
      'You write concise professional email replies.',
      prompt,
    );
    const now = new Date();
    const [updated] = await db
      .update(emailMessages)
      .set({ aiDraftReply: draft, aiDraftGeneratedAt: now, status: 'draft_reply' })
      .where(eq(emailMessages.id, id))
      .returning();

    return NextResponse.json({ data: { draft, message: updated } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
