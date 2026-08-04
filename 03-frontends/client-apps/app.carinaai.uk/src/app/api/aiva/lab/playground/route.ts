import { NextResponse } from 'next/server';
import {
  buildPlaygroundSystemPrompt,
  streamWorkspacePlayground,
  type PlaygroundThinkingLevel,
  type PlaygroundToolFlags,
} from '@/lib/workspace-llm';
import { ChatStreamError } from '@/lib/chat-errors';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import {
  assertWithinQuota,
  QuotaExceededError,
} from '@/lib/quota';
import { resolveChatAccessPolicy } from '@/lib/chat-access-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PlaygroundMessage = { role: 'user' | 'assistant'; content: string };

function sseFromOpenAiStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'text', content })}\n\n`));
              }
            } catch {
              // skip malformed upstream chunks
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Playground stream failed';
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    message?: string;
    messages?: PlaygroundMessage[];
    systemPrompt?: string;
    provider?: string;
    model?: string;
    temperature?: number;
    thinkingLevel?: PlaygroundThinkingLevel;
    tools?: PlaygroundToolFlags;
  } | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const history = Array.isArray(body.messages) ? body.messages : [];
  const latest =
    String(body.message ?? '').trim() ||
    [...history].reverse().find((m) => m.role === 'user')?.content?.trim() ||
    '';
  if (!latest) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const workspace = await requireWorkspace(session.user.id);
  const providerKeys = await getDecryptedWorkspaceKeys(workspace.id);
  const chatAccess = await resolveChatAccessPolicy(workspace, providerKeys.length > 0);

  if (chatAccess.mode === 'platform') {
    try {
      await assertWithinQuota(workspace);
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        return NextResponse.json({ error: err.message, upgradeUrl: chatAccess.upgradeUrl }, { status: 429 });
      }
      throw err;
    }
  }

  if (providerKeys.length === 0) {
    return NextResponse.json(
      {
        error: 'Add at least one provider key in Settings before using Lab Playground.',
        code: 'NO_BYOK_KEYS',
      },
      { status: 400 },
    );
  }

  const thinkingLevel = (['off', 'low', 'medium', 'high'] as const).includes(
    body.thinkingLevel as PlaygroundThinkingLevel,
  )
    ? (body.thinkingLevel as PlaygroundThinkingLevel)
    : 'medium';

  const tools: PlaygroundToolFlags = {
    webSearch: Boolean(body.tools?.webSearch),
    codeExecution: Boolean(body.tools?.codeExecution),
    structuredOutputs: Boolean(body.tools?.structuredOutputs),
  };

  const systemPrompt = buildPlaygroundSystemPrompt({
    systemPrompt: body.systemPrompt,
    thinkingLevel,
    tools,
  });

  const messages: PlaygroundMessage[] = [
    ...history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content ?? '') }))
      .slice(-20),
  ];
  if (!messages.length || messages[messages.length - 1]?.content !== latest) {
    messages.push({ role: 'user', content: latest });
  }

  try {
    const upstream = await streamWorkspacePlayground({
      keys: providerKeys,
      systemPrompt,
      messages,
      provider: body.provider,
      model: body.model,
      temperature: body.temperature,
      structuredOutputs: tools.structuredOutputs,
    });

    return new Response(sseFromOpenAiStream(upstream.body!), {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    if (err instanceof ChatStreamError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : 'Playground failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
