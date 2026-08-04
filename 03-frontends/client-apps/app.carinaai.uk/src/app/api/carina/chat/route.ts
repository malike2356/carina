import { NextResponse } from 'next/server';
import { CARINA_HELP_KNOWLEDGE_BASE } from '@/lib/carina-help/knowledge';
import { resolveCarinaHelpProvider } from '@/lib/carina-help/provider';
import { carinaHelpRagContext } from '@/lib/carina-help/rag';
import { sanitizeCarinaHelpReply } from '@/lib/carina-help/sanitize-reply';
import { CARINA_HELP_SYSTEM_PROMPT } from '@/lib/carina-help/system-prompt';
import { getDecryptedWorkspaceKeys } from '@/lib/keys';
import { getSession, requireWorkspace } from '@/lib/session';
import { requireWorkspaceFeature } from '@/lib/require-workspace-feature';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ChatMessage = { role: string; content: string };

const BYOK_ENDPOINTS: Record<string, { url: string; model: string }> = {
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  openrouter: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'deepseek/deepseek-chat',
  },
};

async function resolveProviderForWorkspace(workspaceId: string) {
  const platform = resolveCarinaHelpProvider();
  if (platform) return platform;

  const keys = await getDecryptedWorkspaceKeys(workspaceId);
  const preferred =
    keys.find((key) => key.provider === 'deepseek') ??
    keys.find((key) => key.provider === 'openai') ??
    keys.find((key) => BYOK_ENDPOINTS[key.provider]) ??
    null;
  if (!preferred) return null;
  const endpoint = BYOK_ENDPOINTS[preferred.provider];
  if (!endpoint) return null;
  return { url: endpoint.url, key: preferred.apiKey, model: endpoint.model };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const workspace = await requireWorkspace(session.user.id);
  const blocked = await requireWorkspaceFeature(workspace.id, 'ai_chat_assistant');
  if (blocked) return blocked;

  const provider = await resolveProviderForWorkspace(workspace.id);
  if (!provider) {
    return NextResponse.json(
      {
        error:
          'Carina help needs an AI key. Ask your admin to set DEEPSEEK_API_KEY or OPENAI_API_KEY on the app, or add a workspace API key in Settings.',
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    messages?: ChatMessage[];
    currentPage?: string;
  } | null;

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 });
  }

  const latestUser =
    [...messages].reverse().find((m) => m.role === 'user')?.content?.toString() || '';
  const pageContext = body?.currentPage
    ? `\n\nThe user is currently viewing: ${body.currentPage}`
    : '';
  const rag = carinaHelpRagContext(`${latestUser} ${body?.currentPage || ''}`, 5);

  const systemContent = [
    CARINA_HELP_SYSTEM_PROMPT,
    pageContext,
    '',
    '--- AIVA KNOWLEDGE BASE ---',
    // Prefix keeps safety + stuck points; BM25 RAG pulls deeper product-ops sections.
    CARINA_HELP_KNOWLEDGE_BASE.slice(0, 22000),
    rag ? `\n${rag}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const apiMessages = [
    { role: 'system', content: systemContent },
    ...messages.slice(-16).map((m) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: String(m.content ?? '').slice(0, 4000),
    })),
  ];

  let upstream: Response;
  try {
    upstream = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: apiMessages,
        stream: false,
        max_tokens: 1100,
        temperature: 0.35,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI provider unreachable: ${msg}` }, { status: 502 });
  }

  const raw = await upstream.text().catch(() => '');
  if (!upstream.ok) {
    return NextResponse.json(
      { error: `AI provider error (${upstream.status}): ${raw.slice(0, 240)}` },
      { status: 502 },
    );
  }

  let content = '';
  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    content = String(parsed.choices?.[0]?.message?.content ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'AI provider returned invalid JSON' }, { status: 502 });
  }

  if (!content) {
    return NextResponse.json({ error: 'AI provider returned an empty reply' }, { status: 502 });
  }

  return NextResponse.json({ content: sanitizeCarinaHelpReply(content) });
}
