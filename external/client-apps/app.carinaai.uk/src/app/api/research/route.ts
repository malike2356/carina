import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs, type ResearchStatus } from '@/db/schema';
import {
  researchCoreConfigured,
  runSyncCoreResearch,
  startAsyncCoreResearch,
} from '@/lib/research-core';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { streamCarinaChat } from '@/lib/carina-chat';
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

async function markResearchFailed(jobId: string, error: string) {
  await db
    .update(researchJobs)
    .set({
      status: 'failed' satisfies ResearchStatus,
      error,
      completedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId));
}

async function markResearchCompleted(
  jobId: string,
  output: string,
  sources: Array<{ url: string; title: string; snippet: string }>,
) {
  await db
    .update(researchJobs)
    .set({
      status: 'completed',
      output,
      sources,
      completedAt: new Date(),
    })
    .where(eq(researchJobs.id, jobId));
}

async function runLocalResearchFallback(
  jobId: string,
  workspaceId: string,
  query: string,
  mode: string,
  rounds: number,
) {
  const providerKeys = await getDecryptedWorkspaceKeys(workspaceId);
  if (providerKeys.length === 0) {
    await markResearchFailed(
      jobId,
      'Add at least one provider key in Settings before running research.',
    );
    return;
  }

  let output = '';
  const prompt = [
    `Research query: ${query}`,
    `Mode: ${mode}`,
    `Rounds requested: ${rounds}`,
    '',
    'Write a concise research brief with findings, caveats, and next steps. If you cannot verify a detail, say so directly.',
  ].join('\n');

  try {
    for await (const chunk of streamCarinaChat({
      message: prompt,
      sessionId: `research:${jobId}`,
      workspaceId,
      providerKeys,
      skillPacks: [],
    })) {
      if (chunk.type === 'text') output += chunk.content;
    }
    await markResearchCompleted(jobId, output.trim() || `Research completed for ${query}.`, []);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await markResearchFailed(jobId, message);
  }
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
  await db
    .update(researchJobs)
    .set({ status: 'running' })
    .where(eq(researchJobs.id, jobId));

  if (!researchCoreConfigured()) {
    await runLocalResearchFallback(jobId, workspaceId, query, mode, rounds);
    return;
  }

  try {
    const start = await startAsyncCoreResearch({
      jobId,
      workspaceId,
      query,
      mode,
      rounds,
    });

    if (start.status === 404) {
      const result = await runSyncCoreResearch({ query, mode, rounds });
      await markResearchCompleted(jobId, result.markdown, result.sources);
      return;
    }

    if (!start.accepted) {
      await markResearchFailed(
        jobId,
        `Core research failed to start (${start.status}): ${start.body || 'no response body'}`,
      );
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Research failed';
    try {
      const result = await runSyncCoreResearch({ query, mode, rounds });
      await markResearchCompleted(jobId, result.markdown, result.sources);
    } catch (syncError) {
      const syncMessage = syncError instanceof Error ? syncError.message : message;
      await markResearchFailed(jobId, syncMessage);
    }
  }
}
