import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

type RouteContext = { params: Promise<{ id: string }> };

export const dynamic = 'force-dynamic';

async function getOwnedResearchJob(userId: string, jobId: string) {
  const workspace = await requireWorkspace(userId);
  const [job] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.id, jobId), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  return { workspace, job: job ?? null };
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { job } = await getOwnedResearchJob(session.user.id, id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ data: job });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  const { job } = await getOwnedResearchJob(session.user.id, id);
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(researchJobs).where(eq(researchJobs.id, id));
  return NextResponse.json({ data: { ok: true } });
}
