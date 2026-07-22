import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs, type ResearchStatus } from '@/db/schema';
import {
  researchCoreConfigured,
  runSyncCoreResearch,
  startAsyncCoreResearch,
} from '@/lib/research-core';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { streamCarinaChat } from '@/lib/carina-chat';

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

export async function triggerResearchJob(
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
