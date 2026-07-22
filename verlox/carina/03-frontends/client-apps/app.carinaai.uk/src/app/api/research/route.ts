import { NextResponse } from 'next/server';
import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs, type ResearchStatus } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';
import { triggerResearchJob } from '@/lib/research-job-runner';

const VALID_MODES = ['auto', 'product', 'compare', 'how-to', 'fact-check'] as const;

export const dynamic = 'force-dynamic';

function parseMode(value: unknown) {
  return VALID_MODES.includes(value as (typeof VALID_MODES)[number])
    ? (value as (typeof VALID_MODES)[number])
    : 'auto';
}

function parseRounds(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 3;
  return Math.min(Math.max(1, Math.floor(numberValue)), 10);
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);

  // Fail stale running jobs so the UI cannot spin forever after a core crash.
  const staleBefore = new Date(Date.now() - 20 * 60_000);
  await db
    .update(researchJobs)
    .set({
      status: 'failed' satisfies ResearchStatus,
      error: 'Research timed out waiting for core (job left running too long). Retry the query.',
      completedAt: new Date(),
    })
    .where(
      and(
        eq(researchJobs.workspaceId, workspace.id),
        eq(researchJobs.status, 'running'),
        lt(researchJobs.createdAt, staleBefore),
      ),
    );

  const jobs = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.workspaceId, workspace.id))
    .orderBy(desc(researchJobs.createdAt))
    .limit(50);

  return NextResponse.json({ data: jobs });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const body = (await request.json()) as { query?: string; mode?: string; rounds?: number };
  const query = String(body.query ?? '').trim();
  if (query.length < 5) {
    return NextResponse.json({ error: 'query must be at least 5 characters' }, { status: 400 });
  }

  const mode = parseMode(body.mode);
  const rounds = parseRounds(body.rounds);
  const [job] = await db
    .insert(researchJobs)
    .values({
      workspaceId: workspace.id,
      query,
      mode,
      rounds,
      status: 'queued',
    })
    .returning();

  void triggerResearchJob(job.id, workspace.id, query, mode, rounds).catch((error) => {
    console.error('Failed to trigger research job', error);
  });

  return NextResponse.json({ data: job });
}
