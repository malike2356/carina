import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs, type ResearchStatus } from '@/db/schema';
import { getSession, requireWorkspace } from '@/lib/session';

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

async function triggerResearchJob(
  jobId: string,
  workspaceId: string,
  query: string,
  mode: string,
  rounds: number,
) {
  const now = new Date();
  await db
    .update(researchJobs)
    .set({ status: 'running' })
    .where(eq(researchJobs.id, jobId));

  const coreUrl = process.env.CARINA_CORE_URL ?? 'http://localhost:3333';
  const coreKey = process.env.CARINA_INTERNAL_KEY ?? '';

  if (!coreKey) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    await db
      .update(researchJobs)
      .set({
        status: 'completed',
        output: [
          `## Research Summary: ${query}`,
          '',
          'This is a stub result generated in development mode. In production, Carina executes multi-round web search and synthesis in core.carinaai.uk.',
          '',
          '### Key Findings',
          '',
          `- Mode: ${mode}`,
          `- Rounds requested: ${rounds}`,
          '- Finding 1: Placeholder evidence would be synthesized here.',
          '- Finding 2: Conflicting claims would be compared here.',
          '- Finding 3: Follow-up questions would be identified here.',
          '',
          '### Sources',
          '',
          '1. https://example.com/source-1',
          '2. https://example.com/source-2',
        ].join('\n'),
        sources: [
          {
            url: 'https://example.com/source-1',
            title: 'Example Source One',
            snippet: 'Placeholder source metadata for the development stub.',
          },
          {
            url: 'https://example.com/source-2',
            title: 'Example Source Two',
            snippet: 'Second placeholder source used to exercise the sources panel.',
          },
        ],
        completedAt: new Date(),
      })
      .where(eq(researchJobs.id, jobId));
    return;
  }

  const response = await fetch(`${coreUrl}/research/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-key': coreKey,
    },
    body: JSON.stringify({ jobId, workspaceId, query, mode, rounds }),
  });

  if (!response.ok) {
    await db
      .update(researchJobs)
      .set({
        status: 'failed' satisfies ResearchStatus,
        error: `Core research handoff failed with ${response.status}`,
        completedAt: now,
      })
      .where(eq(researchJobs.id, jobId));
  }
}
