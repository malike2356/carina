# Prompt 04 - Rich Message Bubbles

## Objective

Replace the basic rounded-div message rendering with rich, information-dense message components. Every assistant message shows token count, generation time, and per-message controls. Markdown is rendered properly. Code blocks have syntax styling and copy buttons. This is the biggest single visual gap vs Odysseus.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-03 complete. `ChatView.tsx` exists and renders basic bubbles.

After this prompt: Messages look professional, informative, and interactive. Users can copy any message, see exactly how many tokens it used and how long it took, and delete messages they do not want.

---

## Step 1 - Install Markdown Renderer

```bash
pnpm add react-markdown remark-gfm
pnpm add @types/react-markdown --save-dev
```

We use `react-markdown` with `remark-gfm` for GitHub-flavoured markdown (tables, task lists, strikethrough).

Do NOT use `marked` or `dangerouslySetInnerHTML`. Use `react-markdown` only.

---

## Step 2 - Create MarkdownContent Component

Create `src/components/chat/MarkdownContent.tsx`:

```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CopyButton } from './CopyButton';

const codeBlock = ({ node, inline, className, children, ...props }: {
  node?: unknown;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}) => {
  const code = String(children ?? '').replace(/\n$/, '');
  if (inline) {
    return (
      <code className="rounded px-1 py-0.5 text-[0.85em] font-mono bg-code-bg text-code-text" {...props}>
        {code}
      </code>
    );
  }
  return (
    <div className="group relative my-3 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between bg-elevated px-3 py-1.5">
        <span className="text-[10px] font-mono text-text-muted uppercase">
          {(className ?? '').replace('language-', '') || 'code'}
        </span>
        <CopyButton text={code} size="sm" />
      </div>
      <pre className="overflow-x-auto p-4 text-sm bg-code-bg">
        <code className="font-mono text-code-text whitespace-pre" {...props}>
          {code}
        </code>
      </pre>
    </div>
  );
};

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code: codeBlock as React.ComponentType<React.HTMLAttributes<HTMLElement>>,
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
        h1: ({ children }) => <h1 className="mb-2 text-base font-semibold text-text-primary">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-2 text-sm font-semibold text-text-primary">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1.5 text-sm font-medium text-text-primary">{children}</h3>,
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-accent pl-3 text-text-secondary">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="my-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-elevated">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-text-secondary">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-xs text-text-primary border-t border-border">{children}</td>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            {children}
          </a>
        ),
        strong: ({ children }) => <strong className="font-semibold text-text-primary">{children}</strong>,
        em: ({ children }) => <em className="italic text-text-secondary">{children}</em>,
        hr: () => <hr className="my-3 border-border" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

---

## Step 3 - Create CopyButton Component

Create `src/components/chat/CopyButton.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';

export function CopyButton({ text, size = 'md' }: { text: string; size?: 'sm' | 'md' }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <IconButton label={copied ? 'Copied' : 'Copy'} size={size} onClick={copy}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-accent" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </IconButton>
  );
}
```

---

## Step 4 - Create MessageMetadata Component

Create `src/components/chat/MessageMetadata.tsx`:

```tsx
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n === 0) return '';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k tok`;
  return `${n} tok`;
}

export function MessageMetadata({ inputTokens, outputTokens, durationMs, model }: {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  model?: string;
}) {
  const parts: string[] = [];
  if (outputTokens > 0) parts.push(formatTokens(outputTokens));
  if (durationMs > 0) parts.push(formatDuration(durationMs));
  if (model) parts.push(model);

  if (parts.length === 0) return null;

  return (
    <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted font-mono">
      {parts.map((p, i) => (
        <span key={i}>{i > 0 && <span className="mx-1 opacity-40">-</span>}{p}</span>
      ))}
    </div>
  );
}
```

---

## Step 5 - Create ThinkingBlock Component

Create `src/components/chat/ThinkingBlock.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Brain } from 'lucide-react';

export function ThinkingBlock({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3 rounded-lg border border-border bg-elevated overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <Brain className="h-3 w-3 text-accent shrink-0" />
        <span className="flex-1">Thinking process</span>
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2 text-xs text-text-muted font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {content}
        </div>
      )}
    </div>
  );
}
```

---

## Step 6 - Create UserMessage Component

Create `src/components/chat/UserMessage.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { IconButton } from '@/components/ui/IconButton';
import type { ChatMessage } from './types';

interface UserMessageProps {
  message: ChatMessage;
  onDelete?: (id: string) => void;
}

export function UserMessage({ message, onDelete }: UserMessageProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="flex flex-col items-end gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Controls - visible on hover */}
      <div className={`flex items-center gap-0.5 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
        <CopyButton text={message.content} size="sm" />
        {onDelete && (
          <IconButton label="Delete message" size="sm" onClick={() => onDelete(message.id)}>
            <Trash2 className="h-3 w-3 text-danger" />
          </IconButton>
        )}
      </div>

      {/* Bubble */}
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-bubble-user px-4 py-3 text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
        {message.content}
      </div>
    </div>
  );
}
```

---

## Step 7 - Create AssistantMessage Component

Create `src/components/chat/AssistantMessage.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { Trash2, Pin } from 'lucide-react';
import { CopyButton } from './CopyButton';
import { IconButton } from '@/components/ui/IconButton';
import { MarkdownContent } from './MarkdownContent';
import { MessageMetadata } from './MessageMetadata';
import { ThinkingBlock } from './ThinkingBlock';
import { ToolCallBlock } from './ToolCallBlock';
import type { ChatMessage } from './types';

interface AssistantMessageProps {
  message: ChatMessage;
  streaming?: boolean;
  onDelete?: (id: string) => void;
}

export function AssistantMessage({ message, streaming, onDelete }: AssistantMessageProps) {
  const [hovered, setHovered] = useState(false);
  const showMeta = !streaming && (message.outputTokens > 0 || message.durationMs > 0);

  return (
    <div
      className="flex flex-col items-start gap-1 max-w-[85%]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Model badge */}
      {message.model && (
        <span className="text-[10px] font-medium text-text-muted px-0.5">
          {message.model}
        </span>
      )}

      {/* Thinking block */}
      {message.thinkingContent && (
        <div className="w-full">
          <ThinkingBlock content={message.thinkingContent} />
        </div>
      )}

      {/* Tool calls */}
      {message.toolCalls && message.toolCalls.length > 0 && (
        <div className="w-full space-y-2 mb-2">
          {message.toolCalls.map((tc, i) => (
            <ToolCallBlock key={i} toolCall={tc} />
          ))}
        </div>
      )}

      {/* Main bubble */}
      <div className="rounded-2xl rounded-tl-sm bg-bubble-assistant px-4 py-3 text-sm text-text-primary">
        {streaming ? (
          <div className="flex items-center gap-1">
            <span className="whitespace-pre-wrap">{message.content}</span>
            <span className="inline-block h-4 w-0.5 bg-accent animate-pulse ml-0.5" />
          </div>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>

      {/* Metadata + controls row */}
      <div className="flex items-center gap-2">
        {showMeta && (
          <MessageMetadata
            inputTokens={message.inputTokens}
            outputTokens={message.outputTokens}
            durationMs={message.durationMs}
            model={message.model}
          />
        )}
        <div className={`flex items-center gap-0.5 transition-opacity ${hovered ? 'opacity-100' : 'opacity-0'}`}>
          <CopyButton text={message.content} size="sm" />
          {onDelete && (
            <IconButton label="Delete message" size="sm" onClick={() => onDelete(message.id)}>
              <Trash2 className="h-3 w-3 text-danger" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
```

---

## Step 8 - Create SessionHeader Component

Create `src/components/chat/SessionHeader.tsx`:

```tsx
'use client';
import { useState, useRef } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SessionHeaderProps {
  title: string;
  messageCount: number;
  model: string;
  onRename: (title: string) => void;
}

export function SessionHeader({ title, messageCount, model, onRename }: SessionHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setDraft(title);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 10);
  }

  function commitEdit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== title) {
      onRename(draft.trim());
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setEditing(false); setDraft(title); }
  }

  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-2 min-w-0">
        <MessageSquare className="h-3.5 w-3.5 text-text-muted shrink-0" />
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            className="bg-transparent text-sm font-medium text-text-primary outline-none border-b border-border-focus w-full max-w-xs"
          />
        ) : (
          <button
            onClick={startEdit}
            className="text-sm font-medium text-text-primary hover:text-accent truncate max-w-xs transition-colors"
          >
            {title}
          </button>
        )}
        {messageCount > 0 && (
          <span className="shrink-0 text-[10px] text-text-muted">
            {messageCount} {messageCount === 1 ? 'msg' : 'msgs'}
          </span>
        )}
      </div>
      {model && (
        <div className="flex items-center gap-1 text-[10px] text-text-muted">
          <span>{model}</span>
          <ChevronDown className="h-3 w-3" />
        </div>
      )}
    </div>
  );
}
```

---

## Step 9 - Update ChatView to Use All New Components

Update `src/components/chat/ChatView.tsx` to replace the basic div-based rendering with the new components. Replace the `messages.map(...)` section and the streaming section:

```tsx
// Replace the message rendering section in ChatView.tsx:

{messages.map((msg) =>
  msg.role === 'user' ? (
    <UserMessage
      key={msg.id}
      message={msg}
      onDelete={async (id) => {
        await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }}
    />
  ) : (
    <AssistantMessage
      key={msg.id}
      message={msg}
      onDelete={async (id) => {
        await fetch(`/api/messages/${id}`, { method: 'DELETE' });
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }}
    />
  )
)}

{streamingContent && (
  <AssistantMessage
    message={{
      id: 'streaming',
      role: 'assistant',
      content: streamingContent,
      toolCalls: [],
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
      model: '',
      createdAt: new Date().toISOString(),
    }}
    streaming
  />
)}
```

Also update the session header section to use `<SessionHeader>`:

```tsx
<SessionHeader
  title={sessionTitle}
  messageCount={messages.length}
  model={/* current model from settings or last message */}
  onRename={async (title) => {
    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    router.refresh();
  }}
/>
```

---

## Step 10 - Message Delete API Route

Create `src/app/api/messages/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getSession, requireWorkspace } from '@/lib/session';
import { db } from '@/db';
import { chatMessages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const workspace = await requireWorkspace(session.user.id);
  await db
    .delete(chatMessages)
    .where(and(eq(chatMessages.id, params.id), eq(chatMessages.workspaceId, workspace.id)));
  return NextResponse.json({ data: { ok: true } });
}
```

---

## Verification

After this prompt:
1. Assistant messages render markdown (headings, lists, code blocks, tables)
2. Code blocks have a language label and a working copy button
3. Every assistant message shows token count and duration below it (e.g. "142 tok - 1.2s")
4. Hovering a user or assistant message reveals copy and delete icons
5. Clicking delete removes the message from the UI and calls the API
6. Streaming messages show a pulsing cursor at the end
7. The session header shows the session title (click to rename), message count, and model badge
8. ThinkingBlock is rendered but collapsed by default when `thinkingContent` is present
9. No horizontal scrollbar on the messages container
10. TypeScript builds without errors
