import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { researchJobs } from '@/db/schema';
import { streamCarinaChat } from '@/lib/carina-chat';
import {
  ChatStreamError,
  chatErrorPayload,
  isDatabaseSchemaError,
  databaseSchemaErrorMessage,
} from '@/lib/chat-errors';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { resolveActiveCloudProvider } from '@/lib/cloud-chat-provider';
import { plainResearchTitle } from '@/lib/research-plain-title';
import { getSession, requireWorkspace } from '@/lib/session';
import { sanitizeCarinaProse } from '@/lib/writing-style';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const MAX_RESEARCH_CONTEXT = 24_000;

function sseResponse(stream: ReadableStream<Uint8Array>) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function buildResearchSystemContext(query: string, output: string): string {
  const title = plainResearchTitle(query);
  const body = output.length > MAX_RESEARCH_CONTEXT
    ? `${output.slice(0, MAX_RESEARCH_CONTEXT - 3)}...`
    : output;
  return [
    'You are answering a short follow-up about an existing research paper.',
    'Use the paper below as private reference context.',
    'Do not paste the paper back unless the user explicitly asks for a quote or section.',
    'Answer directly and briefly. Do not use em dashes, en dashes, or emojis.',
    '',
    `Paper title: ${title}`,
    'Paper content:',
    body,
  ].join('\n');
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const workspace = await requireWorkspace(session.user.id);
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    message?: string;
    history?: Array<{ role?: string; content?: string }>;
  };

  const message = sanitizeCarinaProse(String(body.message ?? '').trim());
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

  const [job] = await db
    .select()
    .from(researchJobs)
    .where(and(eq(researchJobs.id, id), eq(researchJobs.workspaceId, workspace.id)))
    .limit(1);

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (job.status !== 'completed' || !job.output?.trim()) {
    return NextResponse.json({ error: 'Research is not ready yet' }, { status: 400 });
  }

  const providerKeys = await getDecryptedWorkspaceKeys(workspace.id);
  const provider = resolveActiveCloudProvider(providerKeys, null) ?? undefined;
  const history = Array.isArray(body.history) ? body.history : [];
  const historyBlock = history
    .slice(-6)
    .map((row) => {
      const role = row.role === 'assistant' ? 'Assistant' : 'User';
      const content = sanitizeCarinaProse(String(row.content ?? '').trim());
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const prompt = historyBlock
    ? `Earlier discussion:\n${historyBlock}\n\nUser follow-up: ${message}`
    : message;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(payload: string) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }

      try {
        for await (const chunk of streamCarinaChat({
          message: prompt,
          sessionId: `research-ask:${job.id}`,
          workspaceId: workspace.id,
          providerKeys,
          skillPacks: [],
          provider,
          extraSystemContext: buildResearchSystemContext(job.query, job.output!),
        })) {
          if (chunk.type === 'text') {
            enqueue(JSON.stringify({ type: 'text', content: chunk.content }));
          }
        }
        enqueue('[DONE]');
        } catch (error) {
        if (isDatabaseSchemaError(error)) {
          enqueue(JSON.stringify(chatErrorPayload(databaseSchemaErrorMessage(), 'CHAT_FAILED')));
        } else if (error instanceof ChatStreamError) {
          enqueue(JSON.stringify(chatErrorPayload(error.message, error.code)));
        } else {
          const detail = error instanceof Error ? error.message : String(error);
          enqueue(JSON.stringify(chatErrorPayload(detail || 'Ask failed', 'CHAT_FAILED')));
        }
        enqueue('[DONE]');
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
