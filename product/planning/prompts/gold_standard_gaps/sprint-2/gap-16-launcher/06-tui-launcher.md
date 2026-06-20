# Prompt 06: TUI Launcher (Ink Terminal)

## Reference

Design: `04-launcher_TUI.png`

## Context

When a user runs `carina` with no arguments in a terminal, instead of dropping straight
into chat, they should see the TUI launcher. This is a full-screen terminal UI built with
Ink (React for CLIs).

Layout from design:
- Left column (narrower): system status list with labeled rows and colored values
- Right column (wider): quick-action list + active projects + typed command prompt at bottom
- Header row: "CARINA LAUNCHER" centered title in cyan with version and date/time
- Footer row: keyboard shortcut hints

The TUI should be responsive to terminal width and fall back gracefully on very small
windows (< 80 columns).

## What to Build

### 1. Entry point

In `core.carinaai.uk/bin/carina.ts`, detect no-args invocation and launch the TUI:
```ts
import { renderLauncher } from '../src/ui/tui/launcher';

const args = process.argv.slice(2);
if (args.length === 0 && process.stdin.isTTY) {
  renderLauncher();
  process.exit(0);
}
// ...rest of CLI
```

### 2. Main launcher component

File: `core.carinaai.uk/src/ui/tui/launcher/index.tsx`

```tsx
import { render } from 'ink';
import { LauncherTUI } from './LauncherTUI';

export function renderLauncher() {
  const { unmount } = render(<LauncherTUI />, { exitOnCtrlC: false });
  return unmount;
}
```

File: `core.carinaai.uk/src/ui/tui/launcher/LauncherTUI.tsx`

```tsx
import React, { useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { LauncherHeader } from './LauncherHeader';
import { LauncherFooter } from './LauncherFooter';
import { StatusColumn } from './StatusColumn';
import { QuickActionsColumn } from './QuickActionsColumn';
import { useSystemStatus } from '../../hooks/useSystemStatus';
import { useRecentProjects } from '../../hooks/useRecentProjects';

export function LauncherTUI() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const width = stdout?.columns ?? 80;
  const height = stdout?.rows ?? 24;
  const { status } = useSystemStatus();
  const { recentProjects } = useRecentProjects(5);
  const [command, setCommand] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') { exit(); return; }
    if (key.escape) { exit(); return; }
    if (key.upArrow)   setSelectedIdx(i => Math.max(0, i - 1));
    if (key.downArrow) setSelectedIdx(i => i + 1);
    if (key.return) {
      // dispatch action based on selectedIdx or command
      handleEnter(command, selectedIdx, exit);
      return;
    }
    if (key.backspace || key.delete) {
      setCommand(c => c.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      setCommand(c => c + input);
    }
  });

  const leftWidth = Math.floor(width * 0.33);
  const rightWidth = width - leftWidth - 1;

  return (
    <Box flexDirection="column" width={width} height={height}>
      <LauncherHeader width={width} />
      <Box flexDirection="row" flexGrow={1} borderStyle="single" borderColor="#1a2b45">
        <StatusColumn width={leftWidth} status={status} />
        <Box borderStyle="single" borderColor="#1a2b45" borderTop={false} borderBottom={false} />
        <QuickActionsColumn
          width={rightWidth}
          projects={recentProjects}
          selectedIdx={selectedIdx}
        />
      </Box>
      <LauncherFooter width={width} command={command} />
    </Box>
  );
}

function handleEnter(command: string, selectedIdx: number, exit: () => void) {
  const cmd = command.trim().toLowerCase();
  if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') { exit(); return; }
  if (cmd === 'chat' || cmd === 'c') {
    exit();
    // re-invoke carina in chat mode
    const { execSync } = require('child_process');
    execSync('carina chat', { stdio: 'inherit' });
  }
}
```

### 3. Header

```tsx
// LauncherHeader.tsx
import { Box, Text } from 'ink';

export function LauncherHeader({ width }) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <Box
      width={width}
      paddingX={2}
      paddingY={0}
      borderStyle="single"
      borderColor="#1a2b45"
      justifyContent="space-between"
    >
      <Text color="#4a6a8a">v3.0.0</Text>
      <Text color="#00d4ff" bold>CARINA LAUNCHER</Text>
      <Text color="#4a6a8a">{date}  {time}</Text>
    </Box>
  );
}
```

### 4. Status column (left)

```tsx
// StatusColumn.tsx
import { Box, Text } from 'ink';

const STATUS_ROWS = [
  { label: 'MODEL',    key: 'model'    },
  { label: 'MEMORY',   key: 'memory'   },
  { label: 'SCOUT',    key: 'scout'    },
  { label: 'CHANNELS', key: 'channels' },
  { label: 'SKILLS',   key: 'skills'   },
  { label: 'LATENCY',  key: 'latency'  },
  { label: 'SESSIONS', key: 'sessions' },
  { label: 'UPTIME',   key: 'uptime'   },
];

export function StatusColumn({ width, status }) {
  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1} gap={0}>
      <Text color="#4a6a8a" bold>SYSTEM STATUS</Text>
      <Box marginTop={1} flexDirection="column" gap={0}>
        {STATUS_ROWS.map(row => {
          const val = status?.[row.key] ?? 'loading...';
          const isOk = typeof val === 'string' && !val.toLowerCase().includes('err');
          return (
            <Box key={row.key} justifyContent="space-between">
              <Text color="#6b8aaa">{row.label.padEnd(10)}</Text>
              <Text color={isOk ? '#16c97e' : '#ef4444'}>{val}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
```

Status values to populate in `useSystemStatus()` for TUI:
```ts
{
  model:    'claude-sonnet-4-6',
  memory:   '248 records',
  scout:    'protected',
  channels: '3 active',
  skills:   '12 loaded',
  latency:  '< 200ms',
  sessions:  '0 running',
  uptime:   '14h 22m',
}
```

### 5. Quick actions + projects column (right)

```tsx
// QuickActionsColumn.tsx
import { Box, Text } from 'ink';

const ACTIONS = [
  { key: 'c',      label: 'Continue last session'  },
  { key: 'n',      label: 'Start new session'       },
  { key: 'p',      label: 'Browse projects'         },
  { key: 'm',      label: 'View memory'             },
  { key: 's',      label: 'Run Scout scan'          },
  { key: '?',      label: 'Help'                    },
  { key: 'q',      label: 'Quit'                    },
];

export function QuickActionsColumn({ width, projects, selectedIdx }) {
  return (
    <Box flexDirection="column" width={width} paddingX={2} paddingY={1} gap={1}>
      {/* Quick actions */}
      <Box flexDirection="column">
        <Text color="#4a6a8a" bold>QUICK ACTIONS</Text>
        <Box marginTop={1} flexDirection="column">
          {ACTIONS.map((a, i) => (
            <Box key={a.key}>
              <Text color="#00d4ff">[{a.key}] </Text>
              <Text color={selectedIdx === i ? '#e8f0f8' : '#6b8aaa'}>{a.label}</Text>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Recent projects */}
      {projects.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#4a6a8a" bold>RECENT PROJECTS</Text>
          <Box marginTop={1} flexDirection="column">
            {projects.slice(0, 4).map(p => (
              <Box key={p.id} gap={2}>
                <Text color="#6b8aaa">{p.name.slice(0, 20).padEnd(22)}</Text>
                <Text color="#4a6a8a">{p.lastActivityAgo.padStart(8)}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
```

### 6. Footer + command prompt

```tsx
// LauncherFooter.tsx
import { Box, Text } from 'ink';

export function LauncherFooter({ width, command }) {
  return (
    <Box
      width={width}
      paddingX={2}
      borderStyle="single"
      borderColor="#1a2b45"
      justifyContent="space-between"
      alignItems="center"
    >
      <Text color="#4a6a8a">
        {'[arrows] navigate  [enter] select  [esc] quit'}
      </Text>
      <Box gap={1}>
        <Text color="#4a6a8a">{'>'}</Text>
        <Text color="#e8f0f8">{command}</Text>
        <Text color="#00d4ff">{'|'}</Text>
      </Box>
    </Box>
  );
}
```

### 7. Fallback for narrow terminals

If `stdout.columns < 80`, render a simplified single-column view:
```tsx
if (width < 80) {
  return (
    <Box flexDirection="column" padding={1}>
      <Text color="#00d4ff" bold>CARINA LAUNCHER</Text>
      <Text color="#6b8aaa">Terminal too narrow for full launcher (need 80+ cols).</Text>
      <Text>Press <Text color="#00d4ff">c</Text> to start chat</Text>
      <Text>Press <Text color="#00d4ff">q</Text> to quit</Text>
    </Box>
  );
}
```

### 8. Required packages

Ensure `core.carinaai.uk/package.json` has:
```json
"ink": "^5.0.0",
"react": "^18.0.0"
```

Both should already be present if the TUI directory exists. Verify with:
```bash
cd core.carinaai.uk
pnpm list ink
```

## Verification Checklist

- [ ] `carina` with no args renders the TUI full-screen
- [ ] Header shows version + "CARINA LAUNCHER" in cyan + current time
- [ ] Status column shows live values (model, memory, scout, latency)
- [ ] Quick actions list renders with cyan key shortcuts
- [ ] Recent projects show project name and last-activity time
- [ ] Command prompt accepts typed input (letters echo correctly)
- [ ] Ctrl-C and Esc both exit cleanly (restores terminal state)
- [ ] Up/down arrows cycle through actions (selectedIdx highlights)
- [ ] Typing "c" + Enter starts chat mode
- [ ] Typing "q" + Enter quits
- [ ] Narrow terminal (< 80 cols) shows fallback message instead of crashing

## Files to Create or Modify

- MODIFY `core.carinaai.uk/bin/carina.ts` - detect no-args and call renderLauncher()
- CREATE `core.carinaai.uk/src/ui/tui/launcher/index.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/launcher/LauncherTUI.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/launcher/LauncherHeader.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/launcher/LauncherFooter.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/launcher/StatusColumn.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/launcher/QuickActionsColumn.tsx`
- CREATE `core.carinaai.uk/src/ui/tui/hooks/useSystemStatus.ts`
- CREATE `core.carinaai.uk/src/ui/tui/hooks/useRecentProjects.ts`
