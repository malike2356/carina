# Gap 07 - Prompt 06: CLI Interactive Mode

**Agent:** Claude Code (fallback: Cursor)
**Estimated hours:** 4-5 hrs
**Depends on:** 01-ink-chat-tui.md done (Ink TUI running); 04 done (commands registered)

---

## Read First

```
core.carinaai.uk/src/tui/ink/App.tsx            (from 01 - Ink TUI)
core.carinaai.uk/src/tui/ink/components/        (existing Ink components)
core.carinaai.uk/src/cli/commands/              (all registered commands from 04)
core.carinaai.uk/src/cli/registry.ts
core.carinaai.uk/bin/carina.ts                  (entry point)
```

---

## What Is "Interactive Mode"

When `carina` is run with no arguments (or with `carina --interactive` / `carina -i`), it enters interactive mode: a full terminal experience with:

1. Gradient ASCII banner on startup
2. A fuzzy slash-autocomplete input
3. Session history with Ctrl+R search
4. Inline markdown rendering for responses
5. A status line showing session, model, and connection
6. Multi-line input mode for long prompts

This is the entry point that new users see first. It should feel polished.

This builds on the Ink TUI from 01. Interactive mode = Ink chat TUI + the enhancements below.

---

## 1. Startup Banner (`src/tui/ink/components/Banner.tsx`)

Shown once on launch, before the input appears:

```tsx
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient'; // npm: ink-gradient

// ASCII logo (fits in 80-column terminal):
const LOGO = `
 ██████╗ █████╗ ██████╗ ██╗███╗   ██╗ █████╗
██╔════╝██╔══██╗██╔══██╗██║████╗  ██║██╔══██╗
██║     ███████║██████╔╝██║██╔██╗ ██║███████║
██║     ██╔══██║██╔══██╗██║██║╚██╗██║██╔══██║
╚██████╗██║  ██║██║  ██║██║██║ ╚████║██║  ██║
 ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝
`.trim();

interface BannerProps {
  version: string;
  model: string;
  sessionId: string;
  onDone: () => void;
}

export function Banner({ version, model, sessionId, onDone }: BannerProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Dismiss after 2 seconds or on any keypress
    const timer = setTimeout(() => {
      setVisible(false);
      onDone();
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      <Gradient name="rainbow">
        <Text>{LOGO}</Text>
      </Gradient>
      <Box marginTop={1}>
        <Text dimColor>v{version}  </Text>
        <Text color="cyan">{model}</Text>
        <Text dimColor>  Session: {sessionId.slice(0, 8)}</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Type a message to start  |  / for commands  |  Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
}
```

Install: `pnpm add ink-gradient`

---

## 2. Fuzzy Slash Autocomplete in Input

Extends the composer from 01 with fuzzy filtering:

```tsx
// src/tui/ink/components/FuzzySlashMenu.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

interface FuzzySlashMenuProps {
  query: string;
  commands: SlashCommand[];
  onSelect: (cmd: SlashCommand) => void;
  onClose: () => void;
}

export function FuzzySlashMenu({ query, commands, onSelect, onClose }: FuzzySlashMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fuzzy score: characters of query appear in command name in order
  function fuzzyScore(name: string, q: string): number {
    if (!q) return 1;
    let qi = 0;
    let score = 0;
    for (let i = 0; i < name.length && qi < q.length; i++) {
      if (name[i].toLowerCase() === q[qi].toLowerCase()) {
        score += (qi === 0 || name[i - 1] === ' ' || name[i - 1] === '-') ? 10 : 1;
        qi++;
      }
    }
    return qi === q.length ? score : 0;
  }

  const filtered = commands
    .map(cmd => ({ cmd, score: fuzzyScore(cmd.name, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ cmd }) => cmd);

  useInput((input, key) => {
    if (key.upArrow) setSelectedIndex(prev => Math.max(0, prev - 1));
    if (key.downArrow) setSelectedIndex(prev => Math.min(filtered.length - 1, prev + 1));
    if (key.return) onSelect(filtered[selectedIndex]);
    if (key.escape) onClose();
  });

  if (filtered.length === 0) return null;

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="blue" paddingX={1}>
      {filtered.map((cmd, i) => (
        <Box key={cmd.name}>
          <Text
            color={i === selectedIndex ? 'white' : 'grey'}
            bold={i === selectedIndex}
            backgroundColor={i === selectedIndex ? 'blue' : undefined}
          >
            {' '}/{cmd.name.padEnd(20)}{cmd.description}
          </Text>
        </Box>
      ))}
    </Box>
  );
}
```

---

## 3. Session History with Ctrl+R

```tsx
// src/tui/ink/hooks/use-input-history.ts
import { useState, useCallback } from 'react';
import AsyncStorage from 'node-localstorage'; // or use fs-based storage

export function useInputHistory() {
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const pushToHistory = useCallback((entry: string) => {
    if (!entry.trim()) return;
    setHistory(prev => {
      const updated = [entry, ...prev.filter(e => e !== entry)].slice(0, 1000);
      // Persist to ~/.carina/input-history
      saveHistory(updated);
      return updated;
    });
    setHistoryIndex(-1);
  }, []);

  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    setHistoryIndex(prev => {
      if (direction === 'up') return Math.min(prev + 1, history.length - 1);
      return Math.max(prev - 1, -1);
    });
  }, [history]);

  const currentEntry = historyIndex >= 0 ? history[historyIndex] : null;

  const searchResults = searchMode
    ? history.filter(e => e.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 8)
    : [];

  return {
    pushToHistory, navigateHistory, currentEntry,
    searchMode, setSearchMode, searchQuery, setSearchQuery, searchResults,
  };
}
```

Wire Ctrl+R in the chat input:
```tsx
useInput((input, key) => {
  if (key.ctrl && input === 'r') {
    setSearchMode(true);
    return;
  }
  if (key.upArrow && !searchMode) {
    navigateHistory('up');
    // Set input text to currentEntry
    return;
  }
  if (key.downArrow && !searchMode) {
    navigateHistory('down');
    return;
  }
});
```

History search overlay (`src/tui/ink/components/HistorySearch.tsx`):
```tsx
// Shows when Ctrl+R is pressed
// Input for search query
// List of matching history entries
// Enter selects and inserts into composer
// Escape closes
```

---

## 4. Inline Markdown Rendering

When Carina's responses contain markdown, render it with color in the terminal:

```tsx
// src/tui/ink/components/InlineMarkdown.tsx
import React from 'react';
import { Text, Box } from 'ink';
import { marked } from 'marked'; // npm: marked

interface InlineMarkdownProps {
  content: string;
}

export function InlineMarkdown({ content }: InlineMarkdownProps) {
  const tokens = marked.lexer(content);
  return <Box flexDirection="column">{tokens.map((token, i) => renderToken(token, i))}</Box>;
}

function renderToken(token: any, key: number): React.ReactNode {
  switch (token.type) {
    case 'heading':
      return <Text key={key} bold color="cyan">{token.text}{'\n'}</Text>;

    case 'paragraph':
      return <Text key={key}>{renderInline(token.text)}{'\n'}</Text>;

    case 'code':
      return (
        <Box key={key} borderStyle="single" borderColor="grey" paddingX={1} marginY={1} flexDirection="column">
          {token.lang && <Text dimColor>{token.lang}</Text>}
          <Text>{token.text}</Text>
        </Box>
      );

    case 'list':
      return (
        <Box key={key} flexDirection="column">
          {token.items.map((item: any, i: number) => (
            <Text key={i}>{'  '}<Text color="cyan">{token.ordered ? `${i + 1}.` : '-'}</Text>{' '}{item.text}</Text>
          ))}
        </Box>
      );

    case 'blockquote':
      return (
        <Box key={key} borderLeft borderColor="grey" paddingLeft={1}>
          <Text dimColor>{token.text}</Text>
        </Box>
      );

    case 'hr':
      return <Text key={key} dimColor>{'─'.repeat(40)}</Text>;

    default:
      return <Text key={key}>{token.raw}</Text>;
  }
}

function renderInline(text: string): string {
  // Bold: **text** → text (bold applied at Text level)
  // Italic: *text* → just strip markers for terminal
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')  // bold - apply via wrapping Text bold
    .replace(/\*(.*?)\*/g, '$1')       // italic - no terminal italic, just strip
    .replace(/`(.*?)`/g, '$1'); // inline code - strip backticks
}
```

---

## 5. Multi-Line Input Mode

When the user presses Ctrl+J or types a blank line, enter multi-line mode:

```tsx
// In the chat input component:

const [multiline, setMultiline] = useState(false);
const [lines, setLines] = useState<string[]>(['']);

useInput((input, key) => {
  if (key.ctrl && input === 'j') {
    setMultiline(prev => !prev);
    return;
  }
  if (multiline && key.return && !key.ctrl) {
    // Add new line
    setLines(prev => [...prev, '']);
    return;
  }
  if (multiline && key.ctrl && key.return) {
    // Submit all lines
    const full = lines.join('\n');
    onSubmit(full);
    setLines(['']);
    setMultiline(false);
    return;
  }
});

// In the input render:
if (multiline) {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1}>
      <Text dimColor>Multi-line mode (Ctrl+Enter to send, Ctrl+J to exit)</Text>
      {lines.map((line, i) => (
        <Box key={i}>
          <Text dimColor>{i === lines.length - 1 ? '>' : ' '} </Text>
          {i === lines.length - 1
            ? <TextInput value={line} onChange={(v) => updateLine(i, v)} onSubmit={() => addLine()} />
            : <Text>{line}</Text>
          }
        </Box>
      ))}
    </Box>
  );
}
```

---

## 6. Status Line

Already covered in 03-tui-operator-enhancements.md but the Ink TUI needs its own version:

```tsx
// src/tui/ink/components/StatusLine.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface StatusLineProps {
  sessionId: string;
  model: string;
  tokenCount: number;
  connected: boolean;
  streaming: boolean;
}

export function StatusLine({ sessionId, model, tokenCount, connected, streaming }: StatusLineProps) {
  return (
    <Box borderTop paddingX={1} justifyContent="space-between">
      <Text dimColor>
        Session: <Text color="white">{sessionId.slice(0, 8)}</Text>
      </Text>
      <Text dimColor>
        Model: <Text color="cyan">{model}</Text>
      </Text>
      <Text dimColor>
        Tokens: <Text color="white">{tokenCount.toLocaleString()}</Text>
      </Text>
      <Text color={connected ? 'green' : 'red'}>
        {connected ? (streaming ? 'Streaming' : 'Connected') : 'Disconnected'}
      </Text>
      <Text dimColor>[/] Commands  [Ctrl+R] History  [Ctrl+J] Multi-line</Text>
    </Box>
  );
}
```

---

## 7. Entry Point Changes (`bin/carina.ts`)

```typescript
// In bin/carina.ts - at the top:

const args = process.argv.slice(2);

// No arguments: enter interactive Ink TUI
if (args.length === 0 || args[0] === '--interactive' || args[0] === '-i') {
  import('../src/tui/ink/start').then(({ startInkTUI }) => startInkTUI());
  return;
}

// Otherwise: delegate to CLI command runner
// ... existing CLI code ...
```

Create `src/tui/ink/start.ts`:

```typescript
import React from 'react';
import { render } from 'ink';
import { App } from './App';

export async function startInkTUI() {
  const { unmount } = render(<App />);
  process.on('SIGINT', () => {
    unmount();
    process.exit(0);
  });
}
```

---

## Files to Create

```
core.carinaai.uk/src/tui/ink/
├── components/
│   ├── Banner.tsx
│   ├── FuzzySlashMenu.tsx
│   ├── HistorySearch.tsx
│   ├── InlineMarkdown.tsx
│   └── StatusLine.tsx
├── hooks/
│   └── use-input-history.ts
└── start.ts
```

## Files to Modify

```
bin/carina.ts         → add no-args → Ink TUI branch
src/tui/ink/App.tsx   → wire Banner, FuzzySlashMenu, HistorySearch, StatusLine, multi-line mode
```

## Packages to Add

```bash
pnpm add ink-gradient marked
```

---

## Done When

- [ ] Running `carina` with no args shows the ASCII banner with gradient coloring
- [ ] Banner disappears after 2 seconds and input is ready
- [ ] Typing `/ses` in the input shows `session` and its subcommands via fuzzy match
- [ ] Arrow keys navigate the slash menu; Enter inserts the selected command
- [ ] Ctrl+R opens history search; typing filters by content; Enter inserts selection
- [ ] Up/down arrows without Ctrl+R cycle through history entries
- [ ] Carina responses with markdown show headings in cyan bold, code in a box, lists with bullets
- [ ] Ctrl+J toggles multi-line mode with a visual indicator
- [ ] In multi-line mode, Enter adds a line, Ctrl+Enter sends
- [ ] Status line at bottom shows session ID, model, token count, connection status
