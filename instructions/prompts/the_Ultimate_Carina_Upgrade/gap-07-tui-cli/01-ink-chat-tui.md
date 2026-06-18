# Gap 6, Prompt 01: Ink Chat TUI

> **REUSE RULE:** See `REUSE-RULES.md` in this directory. Implement the behavior described below in Carina's own voice. No competitor product names, labels, CLI output, or UI copy may appear verbatim in shipped code.


**Gap:** 6 - TUI/CLI Gold Standard
**Prompt:** 01 of 07
**Name:** Ink-Based Chat TUI (`carina tui`)
**Agent (primary):** Cursor
**Agent (fallback):** Claude Code
**Estimated effort:** 2 days

---

## Context

Carina currently has a readline-based operator TUI at `src/tui/app.ts` (13KB, 14 files). That TUI stays as-is for operator mode (`carina tui --operator`). This prompt builds a completely NEW Ink/React TUI that launches via `carina tui` (no flags). The two coexist.

The Ink TUI is the consumer-facing chat experience: streaming messages, markdown, thinking blocks, tool call display, model picker, session switcher, and a status bar. It connects to the existing Carina gateway via the same JSON-RPC protocol already used by `src/gateway/cli.ts`.

---

## Read First

```
core.carinaai.uk/src/gateway/cli.ts               JSON-RPC gateway protocol to reuse
core.carinaai.uk/src/tui/app.ts                   Existing readline TUI (do not modify)
core.carinaai.uk/src/tui/index.ts                 TUI entry that currently launches app.ts
core.carinaai.uk/src/cli/entrance.ts              CLI entry, dispatches to tui mode
core.carinaai.uk/src/cli/registry.ts              Command registry, find the "tui" command registration
core.carinaai.uk/package.json                     Check existing deps before adding
strategy/agent-study/hermes-agent/ui-tui/src/     Hermes Ink TUI reference (202 files)
strategy/agent-study/openclaw/src/tui/            OpenClaw readline TUI reference
```

---

## What Exists vs What to Build

```
EXISTS (do not touch):
  src/tui/app.ts                    readline operator TUI
  src/tui/commands.ts, slash-commands.ts, etc.
  src/gateway/cli.ts                JSON-RPC client protocol

BUILD:
  src/tui/ink/app.tsx               root Ink app
  src/tui/ink/components/           all UI components (list below)
  src/tui/ink/transport/json-rpc.ts JSON-RPC client using gateway/cli.ts protocol
  src/tui/ink/streaming/assembler.ts SSE token assembler
  src/tui/ink/hooks/                React hooks for state
  src/tui/ink/index.ts              entry: render(<App />)
```

---

## Step-by-Step Implementation

### Step 1: Install packages

From inside `core.carinaai.uk/`:

```bash
pnpm add ink@5 react@19 @types/react ink-markdown
```

Verify `tsconfig.json` has `"jsx": "react-jsx"` or `"jsx": "react"` and `"esModuleInterop": true`.

### Step 2: Create directory structure

```
src/tui/ink/
  app.tsx
  index.ts
  components/
    MessageList.tsx
    AssistantMessage.tsx
    StreamingMessage.tsx
    ThinkingBlock.tsx
    ToolCallBlock.tsx
    UserMessage.tsx
    ModelPicker.tsx
    SessionSwitcher.tsx
    StatusBar.tsx
    InputBar.tsx
  transport/
    json-rpc.ts
  streaming/
    assembler.ts
  hooks/
    useSession.ts
    useMessages.ts
    useKeyboard.ts
    useTerminalSize.ts
  theme/
    colors.ts
```

### Step 3: JSON-RPC transport (`src/tui/ink/transport/json-rpc.ts`)

This wraps the same gateway endpoints documented in `src/gateway/cli.ts`. Use `fetch` or Node `http` to call the gateway HTTP server (default: `http://localhost:3333`).

```typescript
// src/tui/ink/transport/json-rpc.ts

export interface RpcRequest {
  jsonrpc: '2.0';
  id: string;
  method: string;
  params?: unknown;
}

export interface RpcResponse<T = unknown> {
  jsonrpc: '2.0';
  id: string;
  result?: T;
  error?: { code: number; message: string };
}

export class GatewayClient {
  constructor(private baseUrl: string = 'http://localhost:3333') {}

  async call<T>(method: string, params?: unknown): Promise<T> {
    const body: RpcRequest = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    };
    const res = await fetch(`${this.baseUrl}/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data: RpcResponse<T> = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.result as T;
  }

  // Streaming: opens SSE connection, calls onToken for each token chunk
  async streamChat(
    sessionId: string,
    message: string,
    onToken: (token: string) => void,
    onDone: () => void,
    onError: (err: Error) => void,
  ): Promise<void> {
    // POST to /chat/stream, read SSE lines
    // Each line: "data: <json>" where json has { type: 'token'|'done'|'error', content }
    // Implement with Node http or undici to avoid browser-only EventSource
  }
}
```

Study `src/gateway/cli.ts` to confirm the exact endpoint paths and message formats before implementing.

### Step 4: Streaming assembler (`src/tui/ink/streaming/assembler.ts`)

```typescript
// Accumulates partial tokens into full message content.
// Handles: plain tokens, thinking block open/close markers, tool call open/close markers.

export type TokenType = 'text' | 'thinking_start' | 'thinking_end' | 'tool_call' | 'done';

export interface StreamToken {
  type: TokenType;
  content?: string;
  toolName?: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  duration?: number;
}

export class StreamAssembler {
  private buffer = '';
  private inThinking = false;

  push(raw: string): StreamToken[] {
    // Parse SSE data lines, return typed tokens
    // Emit thinking_start when <think> tag seen, thinking_end on </think>
  }
}
```

### Step 5: Root app (`src/tui/ink/app.tsx`)

```tsx
import React, { useState, useEffect } from 'react';
import { Box, useApp, useInput } from 'ink';
import { MessageList } from './components/MessageList.js';
import { InputBar } from './components/InputBar.js';
import { StatusBar } from './components/StatusBar.js';
import { ModelPicker } from './components/ModelPicker.js';
import { SessionSwitcher } from './components/SessionSwitcher.js';
import { GatewayClient } from './transport/json-rpc.js';
import { useMessages } from './hooks/useMessages.js';
import { useSession } from './hooks/useSession.js';

interface AppProps {
  gatewayUrl?: string;
  sessionId?: string;
}

export function App({ gatewayUrl = 'http://localhost:3333', sessionId }: AppProps) {
  const { exit } = useApp();
  const client = new GatewayClient(gatewayUrl);
  const { session, setSession, sessions, loadSessions } = useSession(client, sessionId);
  const { messages, addUserMessage, appendToken, finalizeAssistant } = useMessages();

  const [overlay, setOverlay] = useState<'none' | 'model' | 'session'>('none');
  const [isStreaming, setIsStreaming] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'ok' | 'error'>('connecting');

  // Ctrl+M = model picker, Ctrl+S = session switcher, Ctrl+C / q = exit
  useInput((input, key) => {
    if (key.ctrl && input === 'm') setOverlay(o => o === 'model' ? 'none' : 'model');
    if (key.ctrl && input === 's') { loadSessions(); setOverlay(o => o === 'session' ? 'none' : 'session'); }
    if (key.escape) setOverlay('none');
  });

  const handleSend = async (text: string) => {
    if (!session || isStreaming) return;
    addUserMessage(text);
    setIsStreaming(true);
    try {
      await client.streamChat(
        session.id,
        text,
        (token) => appendToken(token),
        () => { finalizeAssistant(); setIsStreaming(false); },
        (err) => { console.error(err); setIsStreaming(false); },
      );
    } catch (e) {
      setIsStreaming(false);
    }
  };

  return (
    <Box flexDirection="column" height="100%">
      <MessageList messages={messages} isStreaming={isStreaming} />
      <InputBar onSubmit={handleSend} disabled={isStreaming} />
      <StatusBar
        model={session?.model ?? 'unknown'}
        sessionName={session?.name ?? 'new session'}
        tokenCount={session?.tokenCount ?? 0}
        connectionStatus={connectionStatus}
      />
      {overlay === 'model' && (
        <ModelPicker
          currentModel={session?.model}
          onSelect={(m) => { setSession({ ...session!, model: m }); setOverlay('none'); }}
          onClose={() => setOverlay('none')}
        />
      )}
      {overlay === 'session' && (
        <SessionSwitcher
          sessions={sessions}
          currentSessionId={session?.id}
          onSelect={(s) => { setSession(s); setOverlay('none'); }}
          onClose={() => setOverlay('none')}
        />
      )}
    </Box>
  );
}
```

### Step 6: Components

#### `MessageList.tsx`

- Renders messages in a scrollable `Box` using `overflowY: 'hidden'` with a manual scroll offset tracked in state.
- Up/down arrow keys (when input is not focused) scroll the list.
- Shows `AssistantMessage` for assistant turns and `UserMessage` for user turns.
- When `isStreaming` is true, appends a `StreamingMessage` component after the last assistant message.

#### `AssistantMessage.tsx`

- Renders completed assistant message content as markdown.
- Use `ink-markdown` if available; otherwise implement a simple inline renderer for bold (`**`), inline code (backtick), and fenced code blocks.
- Code blocks: dark background via `<Box backgroundColor="gray">`, syntax label in dim text at top-right.
- Thinking blocks rendered via `ThinkingBlock`.
- Tool calls rendered via `ToolCallBlock`.

#### `StreamingMessage.tsx`

- Receives `tokens: string[]` prop (accumulated so far).
- Joins tokens, renders same markdown as `AssistantMessage` but with a blinking cursor appended.
- Cursor blink: `useEffect` with `setInterval(250ms)` toggling a `|` character visibility.

#### `ThinkingBlock.tsx`

- Props: `content: string`, `isComplete: boolean`, `defaultCollapsed?: boolean`
- When collapsed: shows `[Thinking... N lines]` in dim italic, press `t` to expand.
- When expanded: shows full thinking text in a bordered `Box` with dim styling.
- Spinner (rotating `|/-\`) while `!isComplete`.

#### `ToolCallBlock.tsx`

- Props: `toolName: string`, `args: unknown`, `result?: unknown`, `duration?: number`, `isRunning: boolean`
- Header line: tool name + spinner (if running) or green checkmark (if done) + duration in dim.
- Args: one-line summary (first 80 chars of JSON, truncated with `...`).
- Result: collapsed by default. Press `x` to expand. Full result in bordered box.
- Error result: red border, error message visible without expanding.

#### `UserMessage.tsx`

- Right-aligned using `justifyContent: 'flex-end'`.
- Dimmed (`color="gray"`) after the next assistant response arrives.
- No markdown rendering (show raw text).

#### `ModelPicker.tsx`

- Full-screen overlay (`position: 'absolute'` via Ink `Box`).
- Groups models by provider (Claude, OpenAI, Gemini, Local, Other).
- Keyboard: `j`/`k` to move down/up, `Enter` to select, `Esc` to close.
- Current model highlighted with `>` prefix and bold text.
- Cost indicator next to each model: `$0.003/1K` in dim text.
- Data source: call `client.call('models.list')` on mount.

#### `SessionSwitcher.tsx`

- Full-screen overlay.
- Input box at top: fuzzy search over session list (filter by name/date as user types).
- Session list below: name, date, message count, last message preview (50 chars).
- Keyboard: `j`/`k` to navigate, `Enter` to switch, `n` to create new session, `Esc` to close.

#### `StatusBar.tsx`

- Single-line `Box` at bottom with `backgroundColor="black"`.
- Left: model name.
- Center: session name.
- Right: token count + `  [^M model] [^S session] [q quit]` hint in dim text.
- Connection status dot: green = ok, yellow = connecting, red = error.

#### `InputBar.tsx`

- Single-line text input using Ink's `TextInput` (from `ink`) or a custom implementation.
- When disabled (streaming): shows dim placeholder `"Carina is responding..."`.
- Submit on `Enter`. Multi-line: if user types triple-backtick without closing, auto-switch to multi-line mode (collect lines until a line with only triple-backtick).
- Ctrl+L clears conversation display (does not delete session).

### Step 7: Entry point and CLI wiring

**`src/tui/ink/index.ts`:**

```typescript
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';

export function launchInkTUI(options: { gatewayUrl?: string; sessionId?: string }) {
  const { unmount } = render(<App {...options} />, { exitOnCtrlC: true });
  return unmount;
}
```

**Wire into CLI (`src/cli/entrance.ts` or `src/cli/registry.ts`):**

Find the `tui` command registration. The current `tui` command launches `src/tui/app.ts`. Modify so:
- `carina tui` calls `launchInkTUI()`
- `carina tui --operator` calls the existing readline `app.ts` launch

Exact wiring depends on how the tui command is currently registered. Read `registry.ts` to find it before modifying.

### Step 8: Theming (`src/tui/ink/theme/colors.ts`)

```typescript
const supports256 = process.env.COLORTERM === 'truecolor'
  || (process.env.TERM_PROGRAM ?? '').includes('iTerm')
  || (process.env.TERM ?? '').includes('256color');

export const colors = supports256
  ? {
      primary: '#7c6af5',
      accent: '#4fc3f7',
      success: '#66bb6a',
      warning: '#ffa726',
      error: '#ef5350',
      dim: '#9e9e9e',
      background: '#1a1a2e',
      surface: '#16213e',
    }
  : {
      primary: 'blue',
      accent: 'cyan',
      success: 'green',
      warning: 'yellow',
      error: 'red',
      dim: 'gray',
      background: 'black',
      surface: 'black',
    };
```

Use these color values throughout all components. Do not hardcode color strings in component files.

---

## Files to Create

```
core.carinaai.uk/src/tui/ink/app.tsx
core.carinaai.uk/src/tui/ink/index.ts
core.carinaai.uk/src/tui/ink/components/MessageList.tsx
core.carinaai.uk/src/tui/ink/components/AssistantMessage.tsx
core.carinaai.uk/src/tui/ink/components/StreamingMessage.tsx
core.carinaai.uk/src/tui/ink/components/ThinkingBlock.tsx
core.carinaai.uk/src/tui/ink/components/ToolCallBlock.tsx
core.carinaai.uk/src/tui/ink/components/UserMessage.tsx
core.carinaai.uk/src/tui/ink/components/ModelPicker.tsx
core.carinaai.uk/src/tui/ink/components/SessionSwitcher.tsx
core.carinaai.uk/src/tui/ink/components/StatusBar.tsx
core.carinaai.uk/src/tui/ink/components/InputBar.tsx
core.carinaai.uk/src/tui/ink/transport/json-rpc.ts
core.carinaai.uk/src/tui/ink/streaming/assembler.ts
core.carinaai.uk/src/tui/ink/hooks/useSession.ts
core.carinaai.uk/src/tui/ink/hooks/useMessages.ts
core.carinaai.uk/src/tui/ink/hooks/useKeyboard.ts
core.carinaai.uk/src/tui/ink/hooks/useTerminalSize.ts
core.carinaai.uk/src/tui/ink/theme/colors.ts
```

## Files to Modify

```
core.carinaai.uk/src/cli/registry.ts   (or entrance.ts)
  - Find tui command registration
  - Add --operator flag to route to existing readline TUI
  - Default (no flag) routes to launchInkTUI()

core.carinaai.uk/package.json
  - Confirm ink@5, react@19, @types/react are listed as dependencies
```

---

## Done-When Criteria

- `carina tui` opens the Ink TUI, connects to the gateway, and shows an input bar.
- Sending a message streams the response token by token into the UI.
- Thinking blocks appear collapsed with a spinner, expand on `t`.
- Tool calls show name, args summary, and result after completion.
- `Ctrl+M` opens the model picker overlay, `Enter` selects, `Esc` closes.
- `Ctrl+S` opens session switcher with fuzzy search working.
- Status bar updates with live token count.
- `carina tui --operator` still launches the existing readline TUI unchanged.
- TypeScript compiles with zero errors.
- 256-color support detected and applied; degrades gracefully to 16-color.