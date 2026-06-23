import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions, researchJobs, sessionContextPins } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;

  const [job] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.id, id), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.status !== 'completed' || !job.output) {
    return NextResponse.json({ error: 'Research is not ready for chat yet' }, { status: 400 });
  }

  const title = truncate(`Research: ${job.query}`, 80);
  const [chatSession] = await db
    .insert(chatSessions)
    .values({
      workspaceId: workspace.id,
      title,
    })
    .returning();

  const summary = truncate(job.output, 4000);
  await db
    .insert(sessionContextPins)
    .values({
      sessionId: chatSession.id,
      workspaceId: workspace.id,
      pinType: 'text',
      referenceId: job.id,
      label: truncate(job.query, 60),
      content: [
        `Research report for: ${job.query}`,
        `Mode: ${job.mode}`,
        '',
        summary,
      ].join('\n'),
    })
    .onConflictDoNothing();

  return NextResponse.json({
    data: {
      sessionId: chatSession.id,
      researchJobId: job.id,
    },
  });
}
