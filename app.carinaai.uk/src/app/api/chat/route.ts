import { NextResponse } from 'next/server';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { streamCarinaChat } from '@/lib/carina-chat';
import {
  assertWithinQuota,
  estimateTokensFromText,
  QuotaExceededError,
  recordUsage,
} from '@/lib/quota';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  getOrCreateSession,
  saveMessage,
  autoTitleSession,
  getSessionMessages,
} from '@/lib/chat-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    message?: string;
    sessionId?: string;
    provider?: string;
    model?: string;
    mode?: 'chat' | 'agent';
    webSearch?: boolean;
  };

  const message = String(body.message ?? '').trim();
  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 });

  const workspace = await requireWorkspace(session.user.id);

  try {
    await assertWithinQuota(workspace);
  } catch (err) {
    if (err instanceof QuotaExceededError) {
      return NextResponse.json({ error: err.message, upgradeUrl: '/billing' }, { status: 429 });
    }
    throw err;
  }

  const sessionId = await getOrCreateSession(workspace.id, body.sessionId ?? null);

  const existingMessages = await getSessionMessages(sessionId, workspace.id);
  const isFirstMessage = existingMessages.length === 0;

  await saveMessage({
    sessionId,
    workspaceId: workspace.id,
    role: 'user',
    content: message,
  });

  if (isFirstMessage) {
    await autoTitleSession(sessionId, message);
  }

  const providerKeys = await getDecryptedWorkspaceKeys(workspace.id);
  const skillPacks = workspace.activeSkillPacks
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();
  let outputText = '';
  const startTime = Date.now();
  const toolCalls: Array<{
    id: string;
    name: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    status: 'running' | 'done' | 'error';
  }> = [];

  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(payload: string) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }

      enqueue(JSON.stringify({ sessionId }));

      try {
        for await (const event of streamCarinaChat({
          message,
          sessionId,
          workspaceId: workspace.id,
          providerKeys,
          skillPacks,
          provider: body.provider,
          model: body.model,
        })) {
          if (event.type === 'text') {
            outputText += event.content;
            enqueue(JSON.stringify(event.content));
          } else if (event.type === 'tool_start') {
            toolCalls.push({
              id: event.id,
              name: event.name,
              input: event.input,
              output: null,
              durationMs: 0,
              status: 'running',
            });
            enqueue(JSON.stringify({
              tool_start: {
                id: event.id,
                name: event.name,
                input: event.input,
              },
            }));
          } else if (event.type === 'tool_done') {
            const toolCall = toolCalls.find((tc) => tc.id === event.id);
            if (toolCall) {
              toolCall.output = event.output;
              toolCall.durationMs = event.durationMs;
              toolCall.status = 'done';
            }
            enqueue(JSON.stringify({
              tool_done: {
                id: event.id,
                output: event.output,
                durationMs: event.durationMs,
              },
            }));
          } else if (event.type === 'tool_error') {
            const toolCall = toolCalls.find((tc) => tc.id === event.id);
            if (toolCall) {
              toolCall.output = event.error;
              toolCall.durationMs = event.durationMs;
              toolCall.status = 'error';
            }
            enqueue(JSON.stringify({
              tool_error: {
                id: event.id,
                error: event.error,
                durationMs: event.durationMs,
              },
            }));
          }
        }

        const durationMs = Date.now() - startTime;
        const inputTokens = estimateTokensFromText(message);
        const outputTokens = estimateTokensFromText(outputText);
        const provider = body.provider || providerKeys[0]?.provider || 'unknown';
        const model = body.model || provider;

        await saveMessage({
          sessionId,
          workspaceId: workspace.id,
          role: 'assistant',
          content: outputText,
          inputTokens,
          outputTokens,
          durationMs,
          model,
          toolCalls,
        });

        await recordUsage(
          workspace.id,
          provider,
          'default',
          inputTokens,
          outputTokens,
        );

        enqueue(JSON.stringify({ meta: { inputTokens, outputTokens, durationMs, sessionId, model } }));
        enqueue('[DONE]');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Chat failed';
        enqueue(JSON.stringify({ error: msg }));
        enqueue('[DONE]');
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
