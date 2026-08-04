import { NextResponse } from 'next/server';
import { and, desc, eq, lt, sql } from 'drizzle-orm';
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
import { requireWorkspaceFeature } from '@/lib/require-workspace-feature';
import { parseCitationStyle, citationStyleLabel } from '@/lib/research-citation-styles';
import { plainResearchTitle } from '@/lib/research-plain-title';
import { sanitizeCarinaProse } from '@/lib/writing-style';

const VALID_MODES = ['auto', 'product', 'compare', 'how-to', 'fact-check'] as const;

export const dynamic = 'force-dynamic';

let citationStyleColumnReady: Promise<void> | null = null;

function ensureCitationStyleColumn() {
  if (!citationStyleColumnReady) {
    citationStyleColumnReady = db
      .execute(
        sql`ALTER TABLE research_jobs ADD COLUMN IF NOT EXISTS citation_style varchar(20) DEFAULT 'apa7' NOT NULL`,
      )
      .then(() => undefined)
      .catch((error) => {
        citationStyleColumnReady = null;
        throw error;
      });
  }
  return citationStyleColumnReady;
}

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
      error: sanitizeCarinaProse(error),
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
      output: sanitizeCarinaProse(output, { preserveWhitespace: true }),
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
  citationStyle: string,
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
    `Citation style: ${citationStyleLabel(parseCitationStyle(citationStyle))}.`,
    '',
    'Write a university-style research brief with Abstract, Introduction, Findings, Conclusion, and References.',
    'Use markdown headings, bullet lists, and bold/italic where helpful.',
    'Do not use em dashes, en dashes, or emojis.',
    'If you cannot verify a detail, say so directly.',
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
  const blocked = await requireWorkspaceFeature(workspace.id, 'ai_agent_tools');
  if (blocked) return blocked;

  await ensureCitationStyleColumn();

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
  const blocked = await requireWorkspaceFeature(workspace.id, 'ai_agent_tools');
  if (blocked) return blocked;
  await ensureCitationStyleColumn();

  const body = (await request.json()) as {
    query?: string;
    mode?: string;
    rounds?: number;
    citationStyle?: string;
  };
  const query = plainResearchTitle(String(body.query ?? ''));
  if (query.length < 5) {
    return NextResponse.json({ error: 'query must be at least 5 characters' }, { status: 400 });
  }

  const mode = parseMode(body.mode);
  const rounds = parseRounds(body.rounds);
  const citationStyle = parseCitationStyle(body.citationStyle);
  const [job] = await db
    .insert(researchJobs)
    .values({
      workspaceId: workspace.id,
      query,
      mode,
      rounds,
      citationStyle,
      status: 'queued',
    })
    .returning();

  void triggerResearchJob(job.id, workspace.id, query, mode, rounds, citationStyle).catch((error) => {
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
  citationStyle: string,
) {
  await db
    .update(researchJobs)
    .set({ status: 'running' })
    .where(eq(researchJobs.id, jobId));

  if (!researchCoreConfigured()) {
    await runLocalResearchFallback(jobId, workspaceId, query, mode, rounds, citationStyle);
    return;
  }

  try {
    const start = await startAsyncCoreResearch({
      jobId,
      workspaceId,
      query,
      mode,
      rounds,
      citationStyle,
    });

    if (start.status === 404) {
      const result = await runSyncCoreResearch({ query, mode, rounds, citationStyle });
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
      const result = await runSyncCoreResearch({ query, mode, rounds, citationStyle });
      await markResearchCompleted(jobId, result.markdown, result.sources);
    } catch (syncError) {
      const syncMessage = syncError instanceof Error ? syncError.message : message;
      await markResearchFailed(jobId, syncMessage);
    }
  }
}
