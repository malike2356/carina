# Prompt 03 - Chat Page and Session Routing

## Objective

Create the chat page at `/chat/[sessionId]` and update the API route to persist messages. The current chat is on `/dashboard` with ephemeral state. We move it to a dedicated route where every session has a URL, messages survive reload, and the sidebar can link to past sessions.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompt 01 (schema) and Prompt 02 (layout/shell) must be complete.

Current state: `src/app/(workspace)/dashboard/page.tsx` renders a `<ChatPanel />` that stores messages only in React state. The session ID is ephemeral (`session-${Date.now()}`). Nothing persists to the database.

After this prompt: every chat lives at `/chat/[sessionId]`. The dashboard becomes a simple landing page that redirects new users to start a chat. The API route persists user and assistant messages to the `chat_messages` table.

---

## Step 1 - Create Chat Session Page

Create `src/app/(workspace)/chat/[sessionId]/page.tsx`:

```tsx
import { notFound, redirect } from 'next/navigation';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getSessionMessages } from '@/lib/chat-sessions';
import { ChatView } from '@/components/chat/ChatView';

export const dynamic = 'force-dynamic';

interface Props {
  params: { sessionId: string };
}

export default async function ChatPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);

  const [chatSession] = await db
    .select()
    .from(chatSessions)
    .where(
      and(
        eq(chatSessions.id, params.sessionId),
        eq(chatSessions.workspaceId, workspace.id),
      ),
    )
    .limit(1);

  if (!chatSession) notFound();

  const messages = await getSessionMessages(params.sessionId, workspace.id);

  return (
    <ChatView
      sessionId={chatSession.id}
      sessionTitle={chatSession.title}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant',
        content: m.content,
        toolCalls: (m.toolCalls as unknown[]) ?? [],
        thinkingContent: m.thinkingContent ?? undefined,
        inputTokens: m.inputTokens,
        outputTokens: m.outputTokens,
        durationMs: m.durationMs,
        model: m.model,
        createdAt: m.createdAt.toISOString(),
      }))}
      workspacePlan={workspace.plan}
    />
  );
}
```

---

## Step 2 - Update Dashboard Page

Replace `src/app/(workspace)/dashboard/page.tsx` with a landing page that either shows a welcome state or redirects to the most recent session:

```tsx
import { redirect } from 'next/navigation';
import { getSession, requireWorkspace } from '@/lib/session';
import { listSessions } from '@/lib/chat-sessions';
import Link from 'next/link';
import { MessageSquare, Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const workspace = await requireWorkspace(session.user.id);
  const sessions = await listSessions(workspace.id, 1);

  if (sessions.length > 0) {
    redirect(`/chat/${sessions[0].id}`);
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-text-primary">Welcome to Carina</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Your AI property assistant. Start a conversation to get to work.
        </p>
      </div>
      <Link
        href="/api/sessions/new-redirect"
        className="flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent-hover transition-colors"
      >
        <Plus className="h-4 w-4" />
        Start first chat
      </Link>
    </div>
  );
}
```

Also create `src/app/api/sessions/new-redirect/route.ts` to create a session and redirect:

```ts
import { redirect } from 'next/navigation';
import { getSession, requireWorkspace } from '@/lib/session';
import { getOrCreateSession } from '@/lib/chat-sessions';

export async function GET() {
  const session = await getSession();
  if (!session) redirect('/login');
  const workspace = await requireWorkspace(session.user.id);
  const id = await getOrCreateSession(workspace.id, null);
  redirect(`/chat/${id}`);
}
```

---

## Step 3 - Update the Chat API Route to Persist Messages

Replace `src/app/api/chat/route.ts` with a version that:
1. Accepts `sessionId` in the body
2. Saves the user message before streaming
3. Saves the full assistant message after streaming completes
4. Records timing and token metadata
5. Auto-titles the session from the first user message

```ts
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
import { db } from '@/db';
import { chatSessions, chatMessages } from '@/db/schema';
import { eq, count } from 'drizzle-orm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    message?: string;
    sessionId?: string;
    provider?: string;
    mode?: 'chat' | 'agent';
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
        })) {
          outputText += chunk;
          enqueue(JSON.stringify(chunk));
        }

        const durationMs = Date.now() - startTime;
        const inputTokens = estimateTokensFromText(message);
        const outputTokens = estimateTokensFromText(outputText);

        await saveMessage({
          sessionId,
          workspaceId: workspace.id,
          role: 'assistant',
          content: outputText,
          inputTokens,
          outputTokens,
          durationMs,
          model: body.provider ?? providerKeys[0]?.provider ?? 'unknown',
        });

        await recordUsage(
          workspace.id,
          body.provider ?? providerKeys[0]?.provider ?? 'deepseek',
          'default',
          inputTokens,
          outputTokens,
        );

        enqueue(JSON.stringify({ meta: { inputTokens, outputTokens, durationMs, sessionId } }));
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
```

Note: The stream now emits:
- First frame: `{ sessionId }` so the client knows the session ID (important when the client sent no sessionId)
- Content frames: `"string chunk"`
- Final frame: `{ meta: { inputTokens, outputTokens, durationMs, sessionId } }`
- Terminal: `[DONE]`

---

## Step 4 - Create Session PATCH/DELETE Routes

Create `src/app/api/sessions/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatSessions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getWorkspaceSession(userId: string, sessionId: string) {
  const workspace = await requireWorkspace(userId);
  const [s] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.workspaceId, workspace.id)))
    .limit(1);
  return { workspace, chatSession: s ?? null };
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { workspace, chatSession } = await getWorkspaceSession(session.user.id, params.id);
  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json() as {
    title?: string;
    archived?: boolean;
    pinned?: boolean;
  };

  const updates: Partial<typeof chatSessions.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.title === 'string') updates.title = body.title.slice(0, 200);
  if (typeof body.archived === 'boolean') updates.archived = body.archived;
  if (typeof body.pinned === 'boolean') updates.pinned = body.pinned;

  await db.update(chatSessions).set(updates).where(eq(chatSessions.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { chatSession } = await getWorkspaceSession(session.user.id, params.id);
  if (!chatSession) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.delete(chatSessions).where(eq(chatSessions.id, params.id));
  return NextResponse.json({ data: { ok: true } });
}
```

---

## Step 5 - ChatView Types File

Create `src/components/chat/types.ts` to share message type across components:

```ts
export interface ToolCall {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: ToolCall[];
  thinkingContent?: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model: string;
  createdAt: string;
  streaming?: boolean;
}
```

---

## Step 6 - Create ChatView Skeleton

Create `src/components/chat/ChatView.tsx` as a client component. This is the top-level chat component that replaces `ChatPanel`. It receives `initialMessages` from the server page and manages streaming. The full rich message rendering is built in Prompt 04, but this skeleton must exist now so the page compiles:

```tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessage } from './types';

interface ChatViewProps {
  sessionId: string;
  sessionTitle: string;
  initialMessages: ChatMessage[];
  workspacePlan: string;
}

export function ChatView({ sessionId, sessionTitle, initialMessages, workspacePlan }: ChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [streamingContent, setStreamingContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'chat' | 'agent'>('chat');
  const [meta, setMeta] = useState<{ inputTokens: number; outputTokens: number; durationMs: number } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  async function send(message: string) {
    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      model: '',
      createdAt: new Date().toISOString(),
    }]);
    setBusy(true);
    setStreamingContent('');
    setMeta(null);

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId, mode }),
    });

    if (!res.ok || !res.body) {
      const err = await res.json().catch(() => ({ error: 'Chat failed' }));
      setMessages((prev) => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: String(err.error ?? 'Chat failed'),
        toolCalls: [],
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        model: '',
        createdAt: new Date().toISOString(),
      }]);
      setBusy(false);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistant = '';
    let finalMeta: typeof meta = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed === 'string') {
            assistant += parsed;
            setStreamingContent(assistant);
          } else if (parsed.meta) {
            finalMeta = parsed.meta;
          } else if (parsed.error) {
            assistant += parsed.error;
            setStreamingContent(assistant);
          }
        } catch {
          assistant += data;
          setStreamingContent(assistant);
        }
      }
    }

    setMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: assistant,
      toolCalls: [],
      inputTokens: finalMeta?.inputTokens ?? 0,
      outputTokens: finalMeta?.outputTokens ?? 0,
      durationMs: finalMeta?.durationMs ?? 0,
      model: '',
      createdAt: new Date().toISOString(),
    }]);
    setStreamingContent('');
    setMeta(finalMeta);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex h-full flex-col bg-base">
      {/* Session header - enhanced in Prompt 04 */}
      <div className="border-b border-border px-4 py-2 text-xs text-text-secondary">
        {sessionTitle}
      </div>

      {/* Messages - enhanced in Prompt 04 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
              msg.role === 'user' ? 'bg-bubble-user text-text-primary' : 'bg-bubble-assistant text-text-primary'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap bg-bubble-assistant text-text-primary">
              {streamingContent}
              <span className="inline-block w-1 h-3 ml-0.5 bg-accent animate-pulse" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar - replaced in Prompt 05 */}
      <div className="border-t border-border p-4">
        <ChatInputBar onSend={send} disabled={busy} mode={mode} onModeChange={setMode} />
      </div>
    </div>
  );
}

function ChatInputBar({ onSend, disabled, mode, onModeChange }: {
  onSend: (msg: string) => void;
  disabled: boolean;
  mode: 'chat' | 'agent';
  onModeChange: (m: 'chat' | 'agent') => void;
}) {
  const [value, setValue] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(e as unknown as React.FormEvent);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Message Carina... (Enter to send, Shift+Enter for new line)"
        disabled={disabled}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-elevated px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border-focus disabled:opacity-50"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onModeChange(mode === 'chat' ? 'agent' : 'chat')}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              mode === 'agent'
                ? 'bg-accent-dim text-accent'
                : 'bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            {mode === 'agent' ? 'Agent' : 'Chat'}
          </button>
        </div>
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-black hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Send
        </button>
      </div>
    </form>
  );
}
```

---

## Verification

After this prompt:
1. Navigate to `/dashboard` - it either redirects to an existing session or shows the welcome + "Start first chat" link
2. Clicking "Start first chat" creates a new session and redirects to `/chat/[id]`
3. Sending a message in `/chat/[id]` streams a response
4. Reloading `/chat/[id]` shows the message history (messages survived reload)
5. The sidebar session list updates after a new message is sent
6. The session title auto-sets to the first message text
7. API route emits `{ sessionId }` as the first SSE frame
8. TypeScript compiles without errors
