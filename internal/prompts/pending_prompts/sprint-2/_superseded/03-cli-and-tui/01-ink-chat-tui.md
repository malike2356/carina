# Prompt 01: Ink Chat TUI as Default `carina` Experience


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Running `carina` with no arguments should open an interactive terminal UI (TUI) built with
Ink (React for CLIs). Currently `carina` shows a help text. The TUI is the flagship interface
for operators who live in the terminal.

The TUI must feel like a native terminal app: keyboard navigation, no mouse required,
fast rendering, consistent with the dark theme of the web UI.

## What to Build

### 1. Layout

```
+------------------------------------------+
| Carina v1.0  [S] Sessions [M] Memory      |
| [T] Tools    [P] Projects  [?] Help  [Q]  |
+---------------------+--------------------+
| Sessions            | Chat               |
|                     |                    |
| > main-session      | [system]           |
|   2 min ago         | Carina is ready.   |
|                     |                    |
|   research-abc      | You:               |
|   1 hour ago        | scan example.com   |
|                     |                    |
|   vuln-scan-05      | Carina:            |
|   3 days ago        | Running nmap...    |
|                     | [tool: nmap]       |
+---------------------+--------------------+
| > _                                       |
+------------------------------------------+
```

- Left panel: session list (arrow keys to navigate)
- Right panel: active session chat history (scrollable)
- Bottom: input line (Readline-style editing)
- Top: tab bar for switching between Sessions / Memory / Tools / Projects views

### 2. Implementation

Entry point in `bin/carina.ts`:
```typescript
// If no subcommand given, launch TUI
if (process.argv.length === 2) {
  const { launchTui } = await import('../src/tui/index.js');
  await launchTui();
  process.exit(0);
}
```

Create `src/tui/index.tsx` using Ink:
```typescript
import { render } from 'ink';
import { TuiApp } from './TuiApp.js';

export async function launchTui() {
  const { unmount, waitUntilExit } = render(<TuiApp />);
  await waitUntilExit();
}
```

Key Ink components to build:
- `TuiApp.tsx` - root layout with useInput for global keyboard handlers
- `TabBar.tsx` - top navigation tabs (S, M, T, P keys to switch)
- `SessionList.tsx` - left panel, shows sessions, arrow navigation
- `ChatPanel.tsx` - right panel, renders message history with tool calls
- `InputLine.tsx` - bottom input with readline history

### 3. Streaming responses

When the user sends a message, the chat panel shows streaming tokens:
```
Carina: Running nmap on example.com▋
```
The cursor blinks at the end of partial output. Tool calls show inline:
```
[tool: nmap] scan started
[tool: nmap] found 3 open ports
```

### 4. Keyboard shortcuts

| Key | Action |
|-----|--------|
| Tab / S / M / T / P | Switch active panel |
| Up / Down | Navigate session list |
| Enter (in session list) | Open selected session |
| Ctrl+N | New session |
| Ctrl+C | Cancel current request |
| Ctrl+D | Exit TUI |
| ? | Show keyboard shortcut help overlay |
| Ctrl+K | Command palette (fuzzy search all actions) |

### 5. Dependencies

```bash
pnpm add ink ink-text-input ink-select-input
pnpm add -D @types/react
```

## Verification Checklist

- [ ] `carina` with no args opens TUI without help text
- [ ] Tab key cycles through Sessions / Memory / Tools / Projects views
- [ ] Arrow keys navigate session list, Enter opens session in chat panel
- [ ] Type a message, press Enter - response streams in chat panel with cursor
- [ ] Ctrl+D exits cleanly (process.exit(0), no dangling cursor)
- [ ] Ctrl+N creates a new session (new entry in session list)

## Files to Create or Modify

- MODIFY `bin/carina.ts` - detect no-arg invocation and launch TUI
- CREATE `src/tui/index.tsx`
- CREATE `src/tui/TuiApp.tsx`
- CREATE `src/tui/TabBar.tsx`
- CREATE `src/tui/SessionList.tsx`
- CREATE `src/tui/ChatPanel.tsx`
- CREATE `src/tui/InputLine.tsx`
- MODIFY `package.json` - add ink, ink-text-input, ink-select-input
