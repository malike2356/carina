import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { streamCarinaChat } from '@/lib/carina-chat';
import {
  ChatStreamError,
  chatErrorPayload,
  isNoByokKeysMessage,
  isDatabaseSchemaError,
  databaseSchemaErrorMessage,
} from '@/lib/chat-errors';
import { coreProxyEnabled, requiresWorkspaceByokKeys, resolveCoreUrl } from '@/lib/core-proxy';
import {
  assertWithinQuota,
  QuotaExceededError,
  recordUsage,
} from '@/lib/quota';
import { getSession, requireWorkspace } from '@/lib/session';
import { triggerBrainExtraction } from '@/lib/brain-extract';
import {
  getOrCreateSession,
  saveMessage,
  autoTitleSession,
  getSessionMessages,
} from '@/lib/chat-sessions';
import type { CarinaChatStreamEvent } from '@/lib/carina-chat';
import { estimateTokensFromText } from '@/lib/token-estimation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function appendStreamText(outputText: string, chunk: CarinaChatStreamEvent): string {
  if (chunk.type === 'text') return outputText + chunk.content;
  return outputText;
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as {
    message?: string;
    sessionId?: string;
    provider?: string;
    model?: string;
    mode?: 'chat' | 'agent';
    profileId?: string;
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

  const providerKeys = await getDecryptedWorkspaceKeys(workspace.id);
  if (providerKeys.length === 0 && requiresWorkspaceByokKeys()) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify(
              chatErrorPayload(
                'Add at least one provider key in Settings before chatting.',
                'NO_BYOK_KEYS',
              ),
            )}\n\n`,
          ),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return sseResponse(stream);
  }

  const sessionId = await getOrCreateSession(workspace.id, body.sessionId ?? null);

  if (body.profileId) {
    await db
      .update(chatSessions)
      .set({ profileId: body.profileId, updatedAt: new Date() })
      .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)));
  }

  const [chatSession] = await db
    .select({ profileId: chatSessions.profileId })
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)))
    .limit(1);

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

  const skillPacks = workspace.activeSkillPacks
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  const encoder = new TextEncoder();
  let outputText = '';
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      function enqueue(payload: string) {
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      }

      enqueue(JSON.stringify({ sessionId }));

      try {
        for await (const chunk of streamCarinaChat({
          message,
          sessionId,
          workspaceId: workspace.id,
          providerKeys,
          skillPacks,
          provider: body.provider,
          model: body.model,
          profileId: chatSession?.profileId ?? body.profileId ?? null,
        })) {
          outputText = appendStreamText(outputText, chunk);
          enqueue(JSON.stringify(chunk));
        }

        const durationMs = Date.now() - startTime;
        const inputTokens = estimateTokensFromText(message);
        const outputTokens = estimateTokensFromText(outputText);
        const modelName =
          body.model ??
          body.provider ??
          providerKeys[0]?.provider ??
          'unknown';

        if (outputText.trim()) {
          await saveMessage({
            sessionId,
            workspaceId: workspace.id,
            role: 'assistant',
            content: outputText,
            inputTokens,
            outputTokens,
            durationMs,
            model: modelName,
          });

          await recordUsage(
            workspace.id,
            body.provider ?? providerKeys[0]?.provider ?? 'deepseek',
            body.model ?? 'default',
            inputTokens,
            outputTokens,
          );

          void triggerBrainExtraction({
            workspaceId: workspace.id,
            sessionId,
            mode: body.mode ?? 'chat',
            userMessage: message,
            assistantMessage: outputText,
          }).catch(() => {});
        }

        enqueue(
          JSON.stringify({
            meta: {
              inputTokens,
              outputTokens,
              durationMs,
              sessionId,
              model: modelName,
            },
          }),
        );
        enqueue('[DONE]');
      } catch (err) {
        let payload = chatErrorPayload('Chat failed', 'CHAT_FAILED');
        if (err instanceof ChatStreamError) {
          payload = chatErrorPayload(err.message, err.code);
        } else if (err instanceof Error && isNoByokKeysMessage(err.message)) {
          payload = chatErrorPayload(err.message, 'NO_BYOK_KEYS');
        } else if (isDatabaseSchemaError(err)) {
          payload = chatErrorPayload(databaseSchemaErrorMessage(), 'DB_SCHEMA');
        } else if (err instanceof Error) {
          payload = chatErrorPayload(err.message, 'CHAT_FAILED');
        }
        enqueue(JSON.stringify(payload));
        enqueue('[DONE]');
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}
