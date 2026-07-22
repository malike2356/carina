import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { triggerResearchJob } from '@/lib/research-job-runner';

export const dynamic = 'force-dynamic';

const VALID_MODES = ['auto', 'product', 'compare', 'how-to', 'fact-check'] as const;

function authorized(request: Request): boolean {
  const key = request.headers.get('x-internal-key')?.trim();
  return Boolean(process.env.CARINA_INTERNAL_KEY && key === process.env.CARINA_INTERNAL_KEY);
}

function parseMode(value: unknown) {
  return VALID_MODES.includes(value as (typeof VALID_MODES)[number])
    ? (value as (typeof VALID_MODES)[number])
    : 'auto';
}

function parseRounds(value: unknown) {
  const numberValue = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numberValue)) return 6;
  return Math.min(Math.max(1, Math.floor(numberValue)), 10);
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get('workspaceId')?.trim() ?? '';
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 10)));
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(researchJobs)
    .where(eq(researchJobs.workspaceId, workspaceId))
    .orderBy(desc(researchJobs.createdAt))
    .limit(limit);

  return NextResponse.json({ data: rows });
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!workspaceId || query.length < 5) {
    return NextResponse.json({ error: 'workspaceId and query required' }, { status: 400 });
  }

  const mode = parseMode(body.mode);
  const rounds = parseRounds(body.rounds);
  const [job] = await db
    .insert(researchJobs)
    .values({
      workspaceId,
      query,
      mode,
      rounds,
      status: 'queued',
    })
    .returning();

  void triggerResearchJob(job.id, workspaceId, query, mode, rounds).catch((error) => {
    console.error('Failed to trigger internal research job', error);
  });

  return NextResponse.json({
    ok: true,
    data: job,
    openUrl: `/research?open=${job.id}`,
  });
}
