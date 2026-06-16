# Prompt 05 - Tool Call Display

## Objective

Create the `ToolCallBlock` component referenced in Prompt 04, and update the streaming API to emit tool call events so users can watch the agent's actions in real time. Tool calls rendered inline in the chat - collapsible, showing tool name, input, output, and timing.

---

## Context

Working directory: `/opt/lampp/htdocs/verlox/carina/app.carinaai.uk`

Prerequisites: Prompts 00-04 complete.

One of the most visible gaps vs Odysseus: when Carina uses tools (property search, document read, memory lookup), users currently see nothing until the final text response. Odysseus shows every tool call as a live, expandable block. This prompt adds that visibility.

The Carina core agent (`core.carinaai.uk`) already emits tool events as SSE frames when `CARINA_USE_CORE_PROXY=true`. When in direct-call mode (provider API), we need to update the stream to emit synthetic tool events too.

---

## Step 1 - Create ToolCallBlock Component

Create `src/components/chat/ToolCallBlock.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { ChevronDown, ChevronRight, Wrench, CheckCircle, XCircle, Clock } from 'lucide-react';
import { CopyButton } from './CopyButton';
import type { ToolCall } from './types';

function formatJson(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

interface ToolCallBlockProps {
  toolCall: ToolCall;
  status?: 'running' | 'done' | 'error';
}

export function ToolCallBlock({ toolCall, status = 'done' }: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);
  const inputStr = formatJson(toolCall.input);
  const outputStr = formatJson(toolCall.output);

  const statusIcon = {
    running: <Clock className="h-3 w-3 text-text-muted animate-pulse" />,
    done:    <CheckCircle className="h-3 w-3 text-accent" />,
    error:   <XCircle className="h-3 w-3 text-danger" />,
  }[status];

  return (
    <div className="rounded-lg border border-border bg-elevated overflow-hidden text-xs font-mono">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-overlay transition-colors"
      >
        <Wrench className="h-3 w-3 text-text-muted shrink-0" />
        {statusIcon}
        <span className="flex-1 font-medium text-text-secondary">
          {toolCall.name}
          {status === 'running' && <span className="ml-2 text-text-muted italic">running...</span>}
        </span>
        {toolCall.durationMs > 0 && (
          <span className="text-text-muted">{formatDuration(toolCall.durationMs)}</span>
        )}
        {open ? (
          <ChevronDown className="h-3 w-3 text-text-muted" />
        ) : (
          <ChevronRight className="h-3 w-3 text-text-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Input */}
          <div className="px-3 pt-2 pb-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider text-text-muted">Input</span>
              <CopyButton text={inputStr} size="sm" />
            </div>
            <pre className="overflow-x-auto text-[11px] text-code-text bg-code-bg rounded p-2 max-h-32 whitespace-pre-wrap break-words">
              {inputStr}
            </pre>
          </div>

          {/* Output */}
          {(toolCall.output !== undefined && toolCall.output !== null) && (
            <div className="px-3 pt-1 pb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase tracking-wider text-text-muted">Output</span>
                <CopyButton text={outputStr} size="sm" />
              </div>
              <pre className={`overflow-x-auto text-[11px] rounded p-2 max-h-48 whitespace-pre-wrap break-words ${
                status === 'error'
                  ? 'text-danger bg-danger-dim'
                  : 'text-code-text bg-code-bg'
              }`}>
                {outputStr}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## Step 2 - Add Live Tool Call Support to ChatView

Update `src/components/chat/types.ts` to add a live tool call type:

```ts
export interface LiveToolCall {
  id: string;
  name: string;
  input: unknown;
  output: unknown;
  durationMs: number;
  status: 'running' | 'done' | 'error';
}
```

Update `ChatView.tsx` to track in-progress tool calls during streaming:

Add state:
```ts
const [liveToolCalls, setLiveToolCalls] = useState<LiveToolCall[]>([]);
```

Update the SSE parsing inside `send()` to handle tool call frames:

```ts
// In the SSE reading loop, add handling for tool event frames:
const parsed = JSON.parse(data);

if (typeof parsed === 'string') {
  assistant += parsed;
  setStreamingContent(assistant);
} else if (parsed.tool_start) {
  // Tool starting
  setLiveToolCalls((prev) => [
    ...prev,
    {
      id: parsed.tool_start.id,
      name: parsed.tool_start.name,
      input: parsed.tool_start.input ?? {},
      output: null,
      durationMs: 0,
      status: 'running',
    },
  ]);
} else if (parsed.tool_done) {
  // Tool completed
  setLiveToolCalls((prev) =>
    prev.map((tc) =>
      tc.id === parsed.tool_done.id
        ? { ...tc, output: parsed.tool_done.output, durationMs: parsed.tool_done.durationMs, status: 'done' }
        : tc,
    ),
  );
} else if (parsed.tool_error) {
  setLiveToolCalls((prev) =>
    prev.map((tc) =>
      tc.id === parsed.tool_error.id
        ? { ...tc, output: parsed.tool_error.error, status: 'error' }
        : tc,
    ),
  );
} else if (parsed.meta) {
  finalMeta = parsed.meta;
} else if (parsed.error) {
  assistant += `\n\nError: ${parsed.error}`;
  setStreamingContent(assistant);
}
```

In the streaming assistant bubble section, show live tool calls above the streaming content:

```tsx
{streamingContent !== '' && (
  <div className="flex flex-col items-start gap-2 max-w-[85%]">
    {liveToolCalls.length > 0 && (
      <div className="w-full space-y-2">
        {liveToolCalls.map((tc) => (
          <ToolCallBlock key={tc.id} toolCall={tc} status={tc.status} />
        ))}
      </div>
    )}
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
  </div>
)}
```

When the stream ends (after `[DONE]`), move `liveToolCalls` into the final assistant message's `toolCalls` array, then clear `liveToolCalls`:

```ts
const finalToolCalls = liveToolCalls.map((tc) => ({
  id: tc.id,
  name: tc.name,
  input: tc.input,
  output: tc.output,
  durationMs: tc.durationMs,
}));

setMessages((prev) => [...prev, {
  id: crypto.randomUUID(),
  role: 'assistant',
  content: assistant,
  toolCalls: finalToolCalls,
  inputTokens: finalMeta?.inputTokens ?? 0,
  outputTokens: finalMeta?.outputTokens ?? 0,
  durationMs: finalMeta?.durationMs ?? 0,
  model: '',
  createdAt: new Date().toISOString(),
}]);
setLiveToolCalls([]);
```

---

## Step 3 - Update Chat API Route to Emit Tool Events

Update `src/app/api/chat/route.ts` to emit `tool_start` and `tool_done` frames when proxying through Carina core.

When `CARINA_USE_CORE_PROXY=true`, the core agent emits its own SSE frames. Pass them through, but rewrite Carina-internal event names to our client format.

When in direct API mode (no core proxy), we cannot emit real tool calls (the provider API does not support tools in this simple implementation). In that case, emit no tool frames. This is acceptable for Phase 1. Tool calls will be properly routed through the core proxy in production.

Add this transformation in the SSE passthrough loop when `CARINA_USE_CORE_PROXY=true`:

```ts
// Remap core SSE events to client events
if (parsed?.type === 'tool_start') {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    tool_start: {
      id: parsed.id,
      name: parsed.name,
      input: parsed.input,
    },
  })}\n\n`));
} else if (parsed?.type === 'tool_result') {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify({
    tool_done: {
      id: parsed.id,
      output: parsed.output,
      durationMs: parsed.duration_ms ?? 0,
    },
  })}\n\n`));
} else if (typeof parsed === 'string') {
  outputText += parsed;
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
}
```

---

## Step 4 - Update saveMessage to Persist Tool Calls

Update `src/lib/chat-sessions.ts` `saveMessage` to properly serialize tool calls into the `tool_calls` JSONB column. The `toolCalls` param is already optional and typed as `unknown[]` from Prompt 01. Ensure the insert correctly maps:

```ts
toolCalls: params.toolCalls && params.toolCalls.length > 0 ? params.toolCalls : null,
```

And in `getSessionMessages`, when returning messages, parse the JSONB:

The Drizzle select already returns `tool_calls` as the parsed value (Drizzle handles JSONB auto-parsing with PostgreSQL). Verify this in `ChatPage` by confirming the `toolCalls` prop maps correctly.

---

## Verification

After this prompt:
1. When Carina uses a tool (e.g. memory lookup), a `ToolCallBlock` appears above the streaming text, showing the tool name with a pulsing clock icon
2. When the tool completes, the clock icon changes to a green check, and the output appears when expanded
3. Clicking the tool block toggles it open/closed
4. Open state shows the input JSON and output JSON in code blocks with copy buttons
5. After the full response, the tool call blocks persist in the saved message (reload and they are still there)
6. If no tools are used, no tool blocks appear
7. Error tool calls show a red `X` and red output block
8. `ToolCallBlock` renders correctly inside `AssistantMessage` for historical messages loaded from DB
9. TypeScript builds without errors
