# Gap 03 - Prompt 02: Chat Engine

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Gap:** 03 Desktop App
**Prompt number:** 02 of 06
**Name:** Chat Engine
**Primary agent:** Cursor
**Fallback agent:** Claude Code
**Estimated hours:** 8-10 h
**Depends on:** Prompt 01 complete (Tauri window opens, gateway-client.ts exists, store atoms exist)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read First

1. `carina-desktop/src/lib/gateway-client.ts` - the HTTP client you will consume (written in prompt 01)
2. `carina-desktop/src/store/chat.ts` - ChatMessage, ToolCall, approval atoms (written in prompt 01)
3. `carina-desktop/src/store/session.ts` - session atoms (written in prompt 01)
4. `core.carinaai.uk/src/security/exec-approval-levels.ts` - ExecApprovalLevel type and logic
5. `strategy/agent-study/hermes-agent/ui-tui/src/components/messageLine.tsx` - message rendering pattern
6. `strategy/agent-study/hermes-agent/ui-tui/src/components/streamingAssistant.tsx` - streaming pattern
7. `strategy/agent-study/hermes-agent/ui-tui/src/components/thinking.tsx` - thinking block pattern
8. `strategy/agent-study/hermes-agent/ui-tui/src/components/prompts.tsx` - approval prompt pattern

Reading these before starting ensures your component interfaces match the store atoms already defined in prompt 01.

---

## Context

The gateway streams responses as Server-Sent Events (SSE). Each event carries a JSON payload. The desktop chat engine must:

1. Open an EventSource when a session becomes active
2. Parse each event and update the `$messages` atom
3. Handle tool calls as sub-items within assistant messages (not separate messages)
4. Show thinking blocks (chain-of-thought reasoning) as collapsible items above the final answer
5. Require approval when the gateway emits an `approval.request` event (using exec-approval-levels.ts tiers)

The exec-approval-levels.ts module defines three levels: `off`, `on-miss`, and `full`. The desktop always shows approval dialogs for `on-miss` when the gateway flags a dangerous command, and for `full` on every shell-exec. The `off` level means no dialog, auto-approve.

---

## What Exists vs What to Build

### What exists (from prompt 01)

- `src/store/chat.ts` - ChatMessage type, ToolCall type, all atoms including `$pendingApproval`
- `src/store/session.ts` - `$currentSessionId`, `$sessions`, `$sessionLoading`
- `src/store/connection.ts` - `$gatewayStatus`, health polling
- `src/lib/gateway-client.ts` - `openStream()`, `submitPrompt()`, `listSessions()`, `cancelRun()`
- `src/components/Sidebar.tsx` - sidebar shell with placeholder session list

### What to build in this prompt

All components under `src/components/chat/` and the session list wiring in the sidebar:

```
src/components/chat/
  MessageList.tsx         virtualized scrolling message list
  AssistantMessage.tsx    full assistant message with markdown, thinking, tool calls
  UserMessage.tsx         user message with edit support
  StreamingMessage.tsx    live token-by-token assistant message
  ThinkingBlock.tsx       collapsible reasoning block
  ToolCallBlock.tsx       expandable tool call with args, result, duration
  MarkdownContent.tsx     syntax-highlighted markdown renderer
  MessageMetadata.tsx     timestamp, model name, copy button
  ApprovalDialog.tsx      modal for dangerous tool approval

src/hooks/
  use-chat-stream.ts      opens EventSource, updates $messages atom
  use-session-actions.ts  load sessions, switch sessions, create new session

src/components/
  Sidebar.tsx             update to show real session list (was placeholder in prompt 01)
  SessionHeader.tsx       title, model name, token count bar above chat
```

---

## Step-by-Step Implementation

### Step 1: SSE event types

Create `carina-desktop/src/lib/stream-events.ts`:

```typescript
// All events the gateway emits over SSE.
// Keep this in sync with the gateway's emit calls in core.carinaai.uk/src/gateway/.

export type StreamEvent =
  | { type: 'token'; content: string; messageId: string }
  | { type: 'thinking'; content: string; messageId: string }
  | { type: 'tool.start'; toolCallId: string; name: string; args: unknown; messageId: string }
  | { type: 'tool.progress'; toolCallId: string; progress?: string }
  | { type: 'tool.complete'; toolCallId: string; result: unknown; durationMs: number }
  | { type: 'tool.error'; toolCallId: string; error: string }
  | { type: 'message.complete'; messageId: string; model?: string; usage?: { inputTokens: number; outputTokens: number } }
  | { type: 'approval.request'; toolName: string; params: unknown; reason: string; runId: string; level: 'on-miss' | 'full' }
  | { type: 'error'; message: string }
  | { type: 'done' };

export function parseStreamEvent(raw: string): StreamEvent | null {
  try {
    return JSON.parse(raw) as StreamEvent;
  } catch {
    return null;
  }
}
```

### Step 2: Chat stream hook

Create `carina-desktop/src/hooks/use-chat-stream.ts`:

```typescript
import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $currentSessionId } from '../store/session.js';
import {
  $messages,
  $isStreaming,
  $streamingMessageId,
  $pendingApproval,
  type ChatMessage,
  type ToolCall,
} from '../store/chat.js';
import { openStream } from '../lib/gateway-client.js';
import { parseStreamEvent } from '../lib/stream-events.js';

function generateId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useChatStream(): void {
  const sessionId = useStore($currentSessionId);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Close any previous stream.
    esRef.current?.close();

    const es = openStream(sessionId);
    esRef.current = es;

    es.onmessage = (ev: MessageEvent<string>) => {
      const event = parseStreamEvent(ev.data);
      if (!event) return;

      const msgs = $messages.get();

      if (event.type === 'token') {
        const existing = msgs.find((m) => m.id === event.messageId);
        if (existing) {
          $messages.set(
            msgs.map((m) =>
              m.id === event.messageId
                ? { ...m, content: m.content + event.content, isStreaming: true }
                : m,
            ),
          );
        } else {
          const newMsg: ChatMessage = {
            id: event.messageId,
            role: 'assistant',
            content: event.content,
            timestamp: Date.now(),
            isStreaming: true,
          };
          $messages.set([...msgs, newMsg]);
          $streamingMessageId.set(event.messageId);
          $isStreaming.set(true);
        }
      }

      if (event.type === 'thinking') {
        const existing = msgs.find((m) => m.id === event.messageId);
        if (existing) {
          $messages.set(
            msgs.map((m) =>
              m.id === event.messageId
                ? { ...m, thinkingContent: (m.thinkingContent ?? '') + event.content }
                : m,
            ),
          );
        } else {
          const newMsg: ChatMessage = {
            id: event.messageId,
            role: 'assistant',
            content: '',
            thinkingContent: event.content,
            timestamp: Date.now(),
            isStreaming: true,
          };
          $messages.set([...msgs, newMsg]);
        }
      }

      if (event.type === 'tool.start') {
        const toolCall: ToolCall = {
          id: event.toolCallId,
          name: event.name,
          args: event.args,
          status: 'running',
        };
        const existing = msgs.find((m) => m.id === event.messageId);
        if (existing) {
          $messages.set(
            msgs.map((m) =>
              m.id === event.messageId
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                : m,
            ),
          );
        } else {
          $messages.set([
            ...msgs,
            {
              id: event.messageId,
              role: 'assistant',
              content: '',
              toolCalls: [toolCall],
              timestamp: Date.now(),
              isStreaming: true,
            },
          ]);
        }
      }

      if (event.type === 'tool.complete') {
        $messages.set(
          msgs.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) =>
              tc.id === event.toolCallId
                ? { ...tc, result: event.result, durationMs: event.durationMs, status: 'done' as const }
                : tc,
            ),
          })),
        );
      }

      if (event.type === 'tool.error') {
        $messages.set(
          msgs.map((m) => ({
            ...m,
            toolCalls: m.toolCalls?.map((tc) =>
              tc.id === event.toolCallId
                ? { ...tc, result: event.error, status: 'error' as const }
                : tc,
            ),
          })),
        );
      }

      if (event.type === 'message.complete') {
        $messages.set(
          msgs.map((m) =>
            m.id === event.messageId ? { ...m, isStreaming: false } : m,
          ),
        );
        $streamingMessageId.set(null);
        $isStreaming.set(false);
      }

      if (event.type === 'approval.request') {
        $pendingApproval.set({
          toolName: event.toolName,
          params: event.params,
          reason: event.reason,
          runId: event.runId,
        });
      }

      if (event.type === 'done' || event.type === 'error') {
        $isStreaming.set(false);
        $streamingMessageId.set(null);
      }
    };

    es.onerror = () => {
      $isStreaming.set(false);
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [sessionId]);
}
```

### Step 3: Markdown content renderer

Create `carina-desktop/src/components/chat/MarkdownContent.tsx`:

```typescript
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';

interface Props {
  content: string;
  className?: string;
}

export default function MarkdownContent({ content, className }: Props) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              {children}
            </a>
          ),
          code: ({ inline, className: cls, children }) => {
            if (inline) {
              return <code className="bg-zinc-800 px-1 rounded text-xs font-mono">{children}</code>;
            }
            return (
              <code className={`${cls ?? ''} text-xs`}>{children}</code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
```

### Step 4: ThinkingBlock component

Create `carina-desktop/src/components/chat/ThinkingBlock.tsx`:

```typescript
import React, { useState } from 'react';

interface Props {
  content: string;
  isStreaming?: boolean;
}

export default function ThinkingBlock({ content, isStreaming }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-700 rounded-md mb-2 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 text-left"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>{'>'}</span>
        <span>{isStreaming ? 'Thinking...' : 'Reasoning'}</span>
        {isStreaming && <span className="ml-auto animate-pulse text-zinc-600">...</span>}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-700">
          {content}
        </div>
      )}
    </div>
  );
}
```

### Step 5: ToolCallBlock component

Create `carina-desktop/src/components/chat/ToolCallBlock.tsx`:

```typescript
import React, { useState } from 'react';
import type { ToolCall } from '../../store/chat.js';

interface Props {
  toolCall: ToolCall;
}

function statusLabel(status: ToolCall['status']): string {
  if (status === 'running') return 'Running';
  if (status === 'error') return 'Error';
  return 'Done';
}

function statusClass(status: ToolCall['status']): string {
  if (status === 'running') return 'text-yellow-400';
  if (status === 'error') return 'text-red-400';
  return 'text-green-400';
}

export default function ToolCallBlock({ toolCall }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-zinc-700 rounded-md mb-1 overflow-hidden text-xs">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 text-left"
      >
        <span className="text-zinc-400 font-mono">{toolCall.name}</span>
        <span className={`ml-auto ${statusClass(toolCall.status)}`}>
          {statusLabel(toolCall.status)}
        </span>
        {toolCall.durationMs !== undefined && (
          <span className="text-zinc-600">{toolCall.durationMs}ms</span>
        )}
        <span className={`transition-transform ${open ? 'rotate-90' : ''} text-zinc-600`}>{'>'}</span>
      </button>
      {open && (
        <div className="border-t border-zinc-700 divide-y divide-zinc-800">
          <div className="px-3 py-2">
            <p className="text-zinc-600 mb-1 uppercase tracking-wide text-[10px]">Args</p>
            <pre className="text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
              {JSON.stringify(toolCall.args, null, 2)}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div className="px-3 py-2">
              <p className="text-zinc-600 mb-1 uppercase tracking-wide text-[10px]">Result</p>
              <pre className={`overflow-x-auto whitespace-pre-wrap break-all ${toolCall.status === 'error' ? 'text-red-400' : 'text-zinc-400'}`}>
                {typeof toolCall.result === 'string'
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 6: MessageMetadata component

Create `carina-desktop/src/components/chat/MessageMetadata.tsx`:

```typescript
import React, { useState } from 'react';

interface Props {
  timestamp: number;
  model?: string;
  onCopy: () => void;
}

export default function MessageMetadata({ timestamp, model, onCopy }: Props) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
      <span>{time}</span>
      {model && <span className="text-zinc-700">{model}</span>}
      <button onClick={handleCopy} className="hover:text-zinc-400">
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
```

### Step 7: AssistantMessage component

Create `carina-desktop/src/components/chat/AssistantMessage.tsx`:

```typescript
import React from 'react';
import type { ChatMessage } from '../../store/chat.js';
import ThinkingBlock from './ThinkingBlock.js';
import ToolCallBlock from './ToolCallBlock.js';
import MarkdownContent from './MarkdownContent.js';
import MessageMetadata from './MessageMetadata.js';

interface Props {
  message: ChatMessage;
}

export default function AssistantMessage({ message }: Props) {
  function handleCopy() {
    void navigator.clipboard.writeText(message.content);
  }

  return (
    <div className="group flex gap-3 px-4 py-3">
      <div className="w-6 h-6 rounded-full bg-indigo-600 flex-shrink-0 flex items-center justify-center text-[10px] font-bold mt-0.5">
        C
      </div>
      <div className="flex-1 min-w-0">
        {message.thinkingContent && (
          <ThinkingBlock
            content={message.thinkingContent}
            isStreaming={message.isStreaming}
          />
        )}
        {message.toolCalls?.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} />
        ))}
        {message.content && (
          <MarkdownContent content={message.content} />
        )}
        {message.isStreaming && !message.content && !message.thinkingContent && (
          <span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse" />
        )}
        <MessageMetadata timestamp={message.timestamp} onCopy={handleCopy} />
      </div>
    </div>
  );
}
```

### Step 8: UserMessage component

Create `carina-desktop/src/components/chat/UserMessage.tsx`:

```typescript
import React, { useState } from 'react';
import type { ChatMessage } from '../../store/chat.js';
import MessageMetadata from './MessageMetadata.js';

interface Props {
  message: ChatMessage;
  onEdit?: (newContent: string) => void;
}

export default function UserMessage({ message, onEdit }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  function handleCopy() {
    void navigator.clipboard.writeText(message.content);
  }

  function handleSaveEdit() {
    if (draft.trim() && onEdit) {
      onEdit(draft.trim());
    }
    setEditing(false);
  }

  return (
    <div className="group flex gap-3 px-4 py-3 justify-end">
      <div className="max-w-[80%]">
        {editing ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-zinc-100 resize-none"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white rounded"
              >
                Send edit
              </button>
            </div>
          </div>
        ) : (
          <div
            className="bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm text-zinc-100 whitespace-pre-wrap"
          >
            {message.content}
          </div>
        )}
        <div className="flex justify-end">
          <MessageMetadata
            timestamp={message.timestamp}
            onCopy={handleCopy}
          />
          {!editing && onEdit && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Step 9: MessageList component

Create `carina-desktop/src/components/chat/MessageList.tsx`:

```typescript
import React, { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import { $messages } from '../../store/chat.js';
import AssistantMessage from './AssistantMessage.js';
import UserMessage from './UserMessage.js';

export default function MessageList() {
  const messages = useStore($messages);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  useEffect(() => {
    if (messages.length > 0) {
      virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: 'smooth' });
    }
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Start a conversation
      </div>
    );
  }

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={messages}
      className="flex-1"
      followOutput="smooth"
      itemContent={(_, message) => {
        if (message.role === 'user') {
          return <UserMessage key={message.id} message={message} />;
        }
        return <AssistantMessage key={message.id} message={message} />;
      }}
    />
  );
}
```

### Step 10: ApprovalDialog component

Create `carina-desktop/src/components/chat/ApprovalDialog.tsx`:

```typescript
import React from 'react';
import { useStore } from '@nanostores/react';
import { $pendingApproval } from '../../store/chat.js';
import { post } from '../../lib/gateway-client.js';

// Note: expose a thin `post` helper from gateway-client.ts for this.
// Add: export async function respondToApproval(runId: string, approved: boolean): Promise<void>

interface Props {
  sessionId: string;
}

export default function ApprovalDialog({ sessionId }: Props) {
  const approval = useStore($pendingApproval);

  if (!approval) return null;

  async function respond(approved: boolean) {
    if (!approval) return;
    try {
      // Call the gateway approval endpoint.
      await fetch('http://localhost:3333/api/chat/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Carina-Surface': 'desktop' },
        body: JSON.stringify({ runId: approval.runId, sessionId, approved }),
      });
    } finally {
      $pendingApproval.set(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5 max-w-lg w-full shadow-2xl">
        <p className="text-sm font-semibold text-zinc-100 mb-1">Tool approval required</p>
        <p className="text-xs text-zinc-400 mb-3">{approval.reason}</p>
        <div className="bg-zinc-800 rounded-lg px-3 py-2 mb-4">
          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wide">Tool</p>
          <p className="text-sm font-mono text-zinc-200">{approval.toolName}</p>
          <p className="text-xs text-zinc-500 mt-2 mb-1 uppercase tracking-wide">Params</p>
          <pre className="text-xs text-zinc-400 overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(approval.params, null, 2)}
          </pre>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => void respond(false)}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 rounded-lg"
          >
            Deny
          </button>
          <button
            onClick={() => void respond(true)}
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Step 11: SessionHeader component

Create `carina-desktop/src/components/SessionHeader.tsx`:

```typescript
import React from 'react';
import { useStore } from '@nanostores/react';
import { $sessions, $currentSessionId } from '../store/session.js';
import { $messages } from '../store/chat.js';
import { cancelRun } from '../lib/gateway-client.js';
import { $isStreaming } from '../store/chat.js';

export default function SessionHeader() {
  const sessions = useStore($sessions);
  const currentId = useStore($currentSessionId);
  const isStreaming = useStore($isStreaming);
  const messages = useStore($messages);

  const session = sessions.find((s) => s.sessionId === currentId);

  if (!session) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/50 flex-shrink-0">
      <p className="flex-1 text-sm font-medium text-zinc-200 truncate">
        {session.title ?? 'New session'}
      </p>
      <span className="text-xs text-zinc-600">{messages.length} messages</span>
      {isStreaming && currentId && (
        <button
          onClick={() => void cancelRun(currentId)}
          className="text-xs text-red-400 hover:text-red-300 border border-red-800 rounded px-2 py-0.5"
        >
          Stop
        </button>
      )}
    </div>
  );
}
```

### Step 12: Update Sidebar with real session list

Replace the placeholder in `carina-desktop/src/components/Sidebar.tsx` with a fully functional version.

The sidebar must:
- Call `listSessions()` on mount and when `$currentSessionId` changes
- Update `$sessions` with the result
- Show each session as a clickable button that sets `$currentSessionId`
- Highlight the active session
- Show a "New session" button that calls a `createSession()` helper (POST /api/sessions/new)
- Show a search input that filters the in-memory session list

Add `createSession` to `src/lib/gateway-client.ts`:
```typescript
export async function createSession(): Promise<SessionInfo> {
  return post<SessionInfo>('/api/sessions', { surface: 'desktop' });
}
```

### Step 13: Wire useChatStream into App.tsx

Update `carina-desktop/src/App.tsx` to:
1. Import and call `useChatStream()` (it subscribes to `$currentSessionId` internally)
2. Render `MessageList` and `SessionHeader` when a session is selected
3. Render `ApprovalDialog` always (it is a no-op when `$pendingApproval` is null)
4. Add a basic chat input area placeholder (the real Composer is built in prompt 03)

---

## Files to Create

```
carina-desktop/src/
  lib/
    stream-events.ts
  hooks/
    use-chat-stream.ts
  components/
    SessionHeader.tsx
    chat/
      MessageList.tsx
      AssistantMessage.tsx
      UserMessage.tsx
      ThinkingBlock.tsx
      ToolCallBlock.tsx
      MarkdownContent.tsx
      MessageMetadata.tsx
      ApprovalDialog.tsx
```

## Files to Modify

```
carina-desktop/src/
  App.tsx                  - add useChatStream(), MessageList, SessionHeader, ApprovalDialog
  components/Sidebar.tsx   - replace placeholder with real session list + New Session button
  lib/gateway-client.ts    - add createSession()
```

---

## Done When

- [ ] Sending a test message via gateway (e.g. via `curl -X POST http://localhost:3333/api/chat`) produces streaming tokens visible in the Tauri window
- [ ] Each token appends to the message in real time without full re-render flicker
- [ ] Tool calls appear as collapsed `ToolCallBlock` rows; expanding one shows args and result
- [ ] Thinking block appears collapsed above the response when gateway emits `thinking` events
- [ ] Approval dialog appears over the chat when `approval.request` event is received
- [ ] Clicking Approve/Deny closes the dialog and sends the response to the gateway
- [ ] Session list in sidebar shows real sessions from `listSessions()`
- [ ] Clicking a session in the sidebar switches the active session and clears the message list
- [ ] "New session" button creates a session and switches to it
- [ ] "Stop" button in the session header calls `cancelRun()` and stops the stream
- [ ] Copying a message via the copy button puts the message content in the clipboard
- [ ] Editing a user message calls `onEdit` with the new text (edit submission flow wired in prompt 03's composer)
- [ ] `npm run type-check` passes with 0 errors