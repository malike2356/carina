# Gap 16 - Prompt 03: Queue Modes & Slash Command

**Gap:** 24 Command Queue & Message Coordination
**Prompt number:** 03 of 03
**Name:** Steer/followup/collect/interrupt logic + /queue slash command
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 01-queue-core.md + 02-session-coordination.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `agents/command-queue.ts` -- CommandQueue with dequeue/complete
2. `agents/command-queue-types.ts` -- QueueMode type
3. `agents/agent-runner.ts` -- agent loop entry (accepts mode param)
4. OpenClaw docs: https://docs.openclaw.ai/concepts/queue (queue modes spec)

---

## Context

The queue from prompts 01-02 handles enqueue/dequeue and coordination. This
prompt adds the behavioral logic for each queue mode and the user-facing
`/queue` slash command.

OpenClaw's four queue modes map to Carina as:

| Mode | OpenClaw Behavior | Carina Implementation |
|------|------------------|----------------------|
| `steer` | Inject into active run. New context replaces/decorates current prompt. | Default. Send `steer` event to active agent turn context. |
| `followup` | Enqueue for later. Runs when active turn completes. | Standard FIFO. Entry waits for lane to be idle. |
| `collect` | Coalesce into single turn. Multiple messages collapsed. | Merge entries within debounce window into one. |
| `interrupt` | Abort active run, run newest. For /stop, /reset, /new. | Abort controller + drain lane + run immediately. |

---

## Goal

### 1. Mode-specific Dequeue Behavior

Extend `agents/command-queue.ts` `dequeue()` to handle modes:

```typescript
dequeue(): QueueEntry | null {
  if (this.globalRunning >= this.config.maxConcurrent) {
    return null;
  }

  // Interrupt always wins -- find the first interrupt entry
  for (const [sessionId, lane] of this.lanes.entries()) {
    const interruptEntry = lane.entries.find(e => e.mode === 'interrupt');
    if (interruptEntry) {
      // Interrupt: abort current turn for this session
      this.abortSession(sessionId);
      // Drain remaining entries (interrupt supersedes everything)
      lane.entries = [interruptEntry];
      lane.state = 'running';
      lane.lastDequeuedAt = Date.now();
      this.globalRunning++;
      // Acquire write lock (force-release old holder)
      this.writeLock.forceRelease(sessionId);
      return interruptEntry;
    }
  }

  // Steer: if lane is 'running', inject via steer instead of dequeuing
  for (const [sessionId, lane] of this.lanes.entries()) {
    if (lane.state === 'running' && lane.entries.length > 0) {
      const steerEntry = lane.entries.find(e => e.mode === 'steer');
      if (steerEntry) {
        lane.entries = lane.entries.filter(e => e.id !== steerEntry.id);
        this.injectSteer(sessionId, steerEntry);
        // Don't increment globalRunning -- steer reuses active turn
        return steerEntry; // caller handles steer differently
      }
    }
  }

  // Followup/collect: round-robin across idle lanes (same as prompt 01)
  // ... (existing round-robin logic from prompt 01)
}
```

### 2. Steer Injection

Create `agents/steer-handler.ts`:

```typescript
export interface SteerEvent {
  type: 'steer';
  entryId: string;
  sessionId: string;
  content: string;
  timestamp: number;
}

export class SteerHandler {
  private activeTurns: Map<string, AbortController> = new Map();

  registerTurn(sessionId: string, ac: AbortController): void {
    this.activeTurns.set(sessionId, ac);
  }

  unregisterTurn(sessionId: string): void {
    this.activeTurns.delete(sessionId);
  }

  /**
   * Inject steer context into the active agent turn.
   * This does NOT abort -- it sends a side-channel message that the
   * agent loop reads on its next tool-call check.
   */
  inject(sessionId: string, steerEvent: SteerEvent): void {
    // The agent loop checks for steer events before each tool call
    // and on each response chunk boundary.
    // Implementation: push to a per-session event buffer that the
    // agent loop's prompt assembler reads.
    this.steerBuffer.set(sessionId, steerEvent);
  }

  getPendingSteer(sessionId: string): SteerEvent | undefined {
    const event = this.steerBuffer.get(sessionId);
    if (event) {
      this.steerBuffer.delete(sessionId);
    }
    return event;
  }

  abortSession(sessionId: string): void {
    const ac = this.activeTurns.get(sessionId);
    if (ac) {
      ac.abort();
      this.activeTurns.delete(sessionId);
    }
  }
}
```

The agent loop (`agents/agent-runner.ts`) checks for pending steer before each
turn/tool call:

```typescript
// Before sending next prompt to LLM:
const steer = this.steerHandler.getPendingSteer(sessionId);
if (steer) {
  // Inject as user message: "[Steer] New context while you were working: ..."
  messages.push({
    role: 'user',
    content: `[Steer] ${steer.content}\n\nContinue with the original task incorporating this new context.`
  });
}
```

### 3. Collect Mode Coalescing

Already partially implemented in prompt 01's `mergeMessages()`. Extend to handle:

```typescript
// When dequeue finds a 'collect' entry followed by more collect entries
// in the same lane, merge them all into one before returning.
private coalesceCollectEntries(lane: QueueLane): QueueEntry | null {
  const first = lane.entries.find(e => e.mode === 'collect');
  if (!first) return null;

  const merged: QueueEntry[] = [first];
  let i = lane.entries.indexOf(first) + 1;

  while (i < lane.entries.length) {
    const next = lane.entries[i];
    if (next.mode === 'collect' && next.channelId === first.channelId) {
      merged.push(next);
      lane.entries.splice(i, 1);
    } else {
      i++;
    }
  }

  if (merged.length === 1) return first;

  // Merge all collected messages
  const combinedContent = merged
    .map((e, idx) => `[Message ${idx + 1}] ${e.message.content || '[non-text]'}`)
    .join('\n\n');

  return {
    ...first,
    message: {
      ...first.message,
      content: combinedContent,
    },
  };
}
```

### 4. `/queue` Slash Command

Add to `cli/commands.ts`:

```
/queue steer        Switch to steer mode (default)
/queue followup     Switch to followup mode (queue behind active turn)
/queue collect      Switch to collect mode (batch rapid messages)
/queue interrupt    Switch to interrupt mode (abort active, run newest)
/queue status       Show current queue mode and depth
/queue config       Show queue config (maxConcurrent, debounceMs, cap, drop)
```

Implementation in the agent command handler:

```typescript
// In agents/command-handler.ts
async handleQueueCommand(
  sessionId: string,
  args: string[],
): Promise<string> {
  const subCommand = args[0]?.toLowerCase();

  if (!subCommand || subCommand === 'status') {
    const status = this.commandQueue.status();
    const config = this.commandQueue.getSessionConfig(sessionId);
    return `Queue: ${config.defaultMode} mode, ${status.totalEntries} pending, ${status.activeLanes} active\nUse /queue <steer|followup|collect|interrupt> to change mode.`;
  }

  const validModes = ['steer', 'followup', 'collect', 'interrupt'];
  if (validModes.includes(subCommand)) {
    this.commandQueue.setSessionConfig(sessionId, {
      defaultMode: subCommand as QueueMode,
    });
    return `Queue mode set to "${subCommand}". Will apply to next message.`;
  }

  return `Unknown queue command. Use: /queue <steer|followup|collect|interrupt|status>`;
}
```

### 5. Interrupt for System Commands

System commands (/stop, /reset, /new) automatically use interrupt mode:

```typescript
// In gateway/router.ts handleCommand:
handleCommand(sessionId: string, command: string, args: string[]): void {
  switch (command) {
    case 'stop':
    case 'reset':
    case 'new':
      // Enqueue as interrupt
      this.commandQueue.enqueue(
        sessionId, 'system', {
          content: `/${command}`,
          timestamp: Date.now(),
          isSystemCommand: true,
        } as IncomingMessage,
        'interrupt'  // Force interrupt mode
      );
      break;
    default:
      // Normal handling
  }
}
```

---

## Testing

```typescript
// tests/agents/command-queue-modes.test.ts
describe('Queue modes', () => {
  it('interrupt entry dequeued before any steers or followups');
  it('interrupt aborts active turn and drain lane');
  it('steer injects into active turn without creating new turn');
  it('followup waits for active turn to complete');
  it('collect coalesces multiple messages in debounce window');
  it('/queue command changes session default mode');
  it('/stop uses interrupt mode automatically');
  it('steer events arrive in agent loop via SteerHandler');
});
```

---

## Existing Carina code to integrate with

- `agents/command-queue.ts` -- extend dequeue() with mode logic
- `agents/steer-handler.ts` -- new file
- `agents/agent-runner.ts` -- check steer buffer before each turn
- `agents/command-handler.ts` -- add `/queue` handler
- `gateway/router.ts` -- system commands use interrupt mode
- `tui/chat-view.ts` -- show queue mode indicator in status bar
