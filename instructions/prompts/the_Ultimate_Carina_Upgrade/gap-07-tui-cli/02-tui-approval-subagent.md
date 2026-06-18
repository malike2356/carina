# Gap 07 - Prompt 02: TUI Approval UI and Subagent Overlay

**Agent:** Claude Code (fallback: Cursor)
**Estimated hours:** 3-4 hrs
**Depends on:** 01-ink-chat-tui.md done (Ink TUI running)

---

## Read First

```
core.carinaai.uk/src/tui/ink/              (from 01 - Ink TUI root)
core.carinaai.uk/src/security/exec-approval-levels.ts
core.carinaai.uk/src/security/tool-runner-security.ts
core.carinaai.uk/src/agents/orchestrator.ts
core.carinaai.uk/src/cli/                  (existing approval prompts in readline TUI)
```

---

## Context

The existing readline TUI (14 files, `src/tui/`) has basic approval prompts. The Ink chat TUI from prompt 01 does not yet have approval UI. This prompt adds:

1. A tiered approval UI (different visual weight for different risk levels)
2. A clarify/sudo prompt pattern
3. A subagent overlay (Ctrl+A to see all running agents)

These components live in `src/tui/ink/components/approval/` and `src/tui/ink/components/agents/`.

---

## 1. Approval Tiers

From `exec-approval-levels.ts`, there are three tiers (or equivalent):
- `low`: auto-approved, just show in event stream
- `medium`: inline approval request in chat (single keystroke)
- `high` / `critical`: full-screen modal, requires typed confirmation

### Tier 1: Inline Approval (`src/tui/ink/components/approval/InlineApproval.tsx`)

For medium-risk tool calls. Rendered inline in the message stream:

```tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface InlineApprovalProps {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: 'medium';
  onApprove: () => void;
  onDeny: () => void;
  onSudo: () => void; // elevate to run without further approval
}

export function InlineApproval({ toolName, args, onApprove, onDeny, onSudo }: InlineApprovalProps) {
  useInput((input, key) => {
    if (input === 'y' || input === 'Y') onApprove();
    if (input === 'n' || input === 'N') onDeny();
    if (input === 's' || input === 'S') onSudo();
  });

  const argsPreview = JSON.stringify(args, null, 2)
    .split('\n')
    .slice(0, 6)
    .join('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
      paddingY={0}
      marginY={1}
    >
      <Text color="yellow" bold>
        [Approval Required] {toolName}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>{argsPreview}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          <Text color="green">[Y]</Text> Approve{'  '}
          <Text color="red">[N]</Text> Deny{'  '}
          <Text color="cyan">[S]</Text> Sudo (approve all similar)
        </Text>
      </Box>
    </Box>
  );
}
```

### Tier 2: Full-Screen Modal Approval (`src/tui/ink/components/approval/ModalApproval.tsx`)

For high/critical risk. Replaces the chat view with a full-screen confirmation:

```tsx
import React, { useState } from 'react';
import { Box, Text, TextInput, useInput } from 'ink';

interface ModalApprovalProps {
  toolName: string;
  args: Record<string, unknown>;
  riskLevel: 'high' | 'critical';
  riskReason: string;
  onApprove: () => void;
  onDeny: () => void;
}

export function ModalApproval({ toolName, args, riskLevel, riskReason, onApprove, onDeny }: ModalApprovalProps) {
  const [confirmText, setConfirmText] = useState('');
  const isCritical = riskLevel === 'critical';
  const confirmWord = isCritical ? 'CONFIRM' : 'yes';

  useInput((input, key) => {
    if (key.escape) onDeny();
  });

  function handleSubmit(value: string) {
    if (value.trim() === confirmWord) {
      onApprove();
    }
  }

  const borderColor = isCritical ? 'red' : 'yellow';

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <Text color={borderColor} bold>
        {isCritical ? 'CRITICAL APPROVAL REQUIRED' : 'HIGH-RISK APPROVAL REQUIRED'}
      </Text>
      <Text color="white" bold marginTop={1}>
        Tool: {toolName}
      </Text>
      <Text color="yellow" marginTop={1}>
        Risk: {riskReason}
      </Text>
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>Arguments:</Text>
        <Text>{JSON.stringify(args, null, 2)}</Text>
      </Box>
      <Box marginTop={2} flexDirection="column">
        <Text>
          Type <Text color={borderColor} bold>{confirmWord}</Text> to approve, or press Escape to deny:
        </Text>
        <Box marginTop={1}>
          <Text color={borderColor}> &gt; </Text>
          <TextInput
            value={confirmText}
            onChange={setConfirmText}
            onSubmit={handleSubmit}
          />
        </Box>
      </Box>
    </Box>
  );
}
```

### Tier 3: Clarify Prompt (`src/tui/ink/components/approval/ClarifyPrompt.tsx`)

When Carina needs more information before proceeding:

```tsx
import React, { useState } from 'react';
import { Box, Text, TextInput } from 'ink';

interface ClarifyPromptProps {
  question: string;
  options?: string[];
  onAnswer: (answer: string) => void;
}

export function ClarifyPrompt({ question, options, onAnswer }: ClarifyPromptProps) {
  const [input, setInput] = useState('');

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      marginY={1}
    >
      <Text color="cyan" bold>Clarification needed</Text>
      <Text marginTop={1}>{question}</Text>
      {options && options.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          {options.map((opt, i) => (
            <Text key={i} dimColor>  [{i + 1}] {opt}</Text>
          ))}
        </Box>
      )}
      <Box marginTop={1}>
        <Text color="cyan"> &gt; </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={onAnswer}
        />
      </Box>
    </Box>
  );
}
```

---

## 2. Sudo Session Mode

When user presses [S] on an inline approval:
- Enter "sudo session" for 5 minutes: all tool calls of the same risk level auto-approve
- Show persistent indicator at bottom of screen: `[SUDO MODE - 4m 32s remaining]`
- Cancel: press Ctrl+X

```typescript
// src/tui/ink/hooks/use-sudo-session.ts
import { useState, useEffect } from 'react';

export function useSudoSession() {
  const [sudoUntil, setSudoUntil] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  const activateSudo = (durationMs = 5 * 60 * 1000) => {
    setSudoUntil(Date.now() + durationMs);
  };

  const deactivateSudo = () => setSudoUntil(null);

  const isSudoActive = () => sudoUntil !== null && Date.now() < sudoUntil;

  useEffect(() => {
    if (!sudoUntil) return;
    const interval = setInterval(() => {
      const rem = sudoUntil - Date.now();
      if (rem <= 0) {
        setSudoUntil(null);
        setRemaining(0);
      } else {
        setRemaining(rem);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sudoUntil]);

  return { isSudoActive, activateSudo, deactivateSudo, remainingMs: remaining };
}
```

Sudo indicator (`src/tui/ink/components/approval/SudoIndicator.tsx`):
```tsx
export function SudoIndicator({ remainingMs }: { remainingMs: number }) {
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.floor((remainingMs % 60_000) / 1000);
  return (
    <Box>
      <Text color="yellow" bold>
        [SUDO MODE - {minutes}m {seconds.toString().padStart(2, '0')}s remaining] Ctrl+X to cancel
      </Text>
    </Box>
  );
}
```

---

## 3. Subagent Overlay (Ctrl+A)

A full-screen overlay showing all running subagents. Toggle with Ctrl+A.

```tsx
// src/tui/ink/components/agents/AgentOverlay.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';
import { useAtom } from 'nanostores/react';
import { $activeAgents } from '../../store/agents';

interface AgentOverlayProps {
  onClose: () => void;
}

export function AgentOverlay({ onClose }: AgentOverlayProps) {
  const [agents] = useAtom($activeAgents);

  useInput((input, key) => {
    if (key.ctrl && input === 'a') onClose();
    if (key.escape) onClose();
  });

  const statusColor = (status: string) => {
    switch (status) {
      case 'running':  return 'green';
      case 'waiting':  return 'yellow';
      case 'complete': return 'grey';
      case 'failed':   return 'red';
      default:         return 'white';
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'running':  return '...';
      case 'waiting':  return '?';
      case 'complete': return '+';
      case 'failed':   return 'x';
      default:         return '-';
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="blue"
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <Text color="blue" bold>Active Agents (Ctrl+A to close)</Text>
      <Box marginTop={1} flexDirection="column">
        {agents.length === 0 && (
          <Text dimColor>No active agents</Text>
        )}
        {agents.map(agent => (
          <Box key={agent.id} marginBottom={1} flexDirection="column">
            <Text>
              <Text color={statusColor(agent.status)} bold>
                [{statusIcon(agent.status)}]
              </Text>
              {' '}<Text bold>{agent.name}</Text>
              {' '}<Text dimColor>({agent.status})</Text>
              {' '}<Text dimColor>{formatDuration(agent.startedAt)}</Text>
            </Text>
            <Text dimColor>    Task: {agent.task.slice(0, 60)}{agent.task.length > 60 ? '...' : ''}</Text>
            {agent.currentTool && (
              <Text color="cyan">    Using: {agent.currentTool}</Text>
            )}
          </Box>
        ))}
      </Box>
      {agents.some(a => a.status === 'running') && (
        <Box marginTop={1}>
          <Text dimColor>Press [C] + agent number to cancel that agent</Text>
        </Box>
      )}
    </Box>
  );
}

function formatDuration(startedAt: number): string {
  const ms = Date.now() - startedAt;
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}
```

Agent nanostore (`src/tui/ink/store/agents.ts`):
```typescript
import { atom } from 'nanostores';

export interface ActiveAgent {
  id: string;
  name: string;
  task: string;
  status: 'running' | 'waiting' | 'complete' | 'failed';
  startedAt: number;
  currentTool?: string;
}

export const $activeAgents = atom<ActiveAgent[]>([]);
```

---

## 4. Integration into Chat TUI

Update `src/tui/ink/App.tsx` from prompt 01:

```tsx
// Add approval state:
const [pendingApproval, setPendingApproval] = useState<ApprovalRequest | null>(null);
const [showAgentOverlay, setShowAgentOverlay] = useState(false);
const { isSudoActive, activateSudo, deactivateSudo, remainingMs } = useSudoSession();

// Handle incoming approval requests from gateway event stream:
// gateway.on('approval.request', (req) => {
//   if (isSudoActive() && req.riskLevel === 'medium') {
//     gateway.approve(req.id); // auto-approve in sudo mode
//   } else {
//     setPendingApproval(req);
//   }
// })

// Global Ctrl+A:
useInput((input, key) => {
  if (key.ctrl && input === 'a') setShowAgentOverlay(prev => !prev);
  if (key.ctrl && input === 'x') deactivateSudo();
});

// Render order (bottom wins in terminal):
// 1. ChatHistory (behind)
// 2. If showAgentOverlay: AgentOverlay
// 3. Else if pendingApproval && risk === 'high'/'critical': ModalApproval
// 4. Else: composer + inline approval if pendingApproval medium
// 5. StatusLine (always bottom)
// 6. SudoIndicator (if sudo active, above StatusLine)
```

---

## Files to Create

```
core.carinaai.uk/src/tui/ink/
├── components/approval/
│   ├── InlineApproval.tsx
│   ├── ModalApproval.tsx
│   ├── ClarifyPrompt.tsx
│   └── SudoIndicator.tsx
├── components/agents/
│   └── AgentOverlay.tsx
├── hooks/
│   └── use-sudo-session.ts
└── store/
    └── agents.ts
```

## Files to Modify

```
src/tui/ink/App.tsx        → add approval state, agent overlay toggle, sudo handling
```

---

## Done When

- [ ] A tool call that requires medium approval shows InlineApproval inline in chat
- [ ] Pressing Y approves, N denies; the stream continues after approval
- [ ] A high-risk tool call shows ModalApproval full screen; typing "yes" approves
- [ ] A critical-risk tool call requires typing "CONFIRM" (uppercase)
- [ ] Pressing S on inline approval activates sudo mode; subsequent medium calls auto-approve
- [ ] SudoIndicator shows countdown timer; disappears when time expires
- [ ] Ctrl+X cancels sudo mode immediately
- [ ] Ctrl+A toggles the agent overlay showing all active subagents
- [ ] Agent overlay shows real-time status updates without closing/reopening
