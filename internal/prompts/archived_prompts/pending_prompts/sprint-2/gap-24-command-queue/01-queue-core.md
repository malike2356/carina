# Gap 16 - Prompt 01: Queue Core Data Structures & Enqueue/Dequeue

**Gap:** 24 Command Queue & Message Coordination
**Prompt number:** 01 of 03
**Name:** Queue core -- data structures, lane assignment, enqueue/dequeue
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing

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

1. `gateway/router.ts` -- current `handleIncoming` dispatch path (lines ~380-500)
2. `gateway/types.ts` -- incoming message shape, session binding
3. `agents/agent-runner.ts` -- agent loop entry point
4. OpenClaw `src/gateway/queue.ts` (in reference repos or docs) for API design
5. This README: `README.md`

---

## Context

Carina has no command queue. When a message arrives on any channel (Telegram,
WebChat, CLI, API), `gateway/router.ts` calls the agent loop directly inside
`handleIncoming`. This means:

- Two rapid messages from the same user create race conditions
- `/stop` commands can't interrupt an in-progress agent turn
- No debouncing -- "hello" + "what's the weather" arrive as two separate turns
- No queue cap -- a flood of messages from a misbehaving client can overwhelm
- No lane isolation -- messages from different sessions compete unfairly

OpenClaw's queue solves all of these with a lane-aware FIFO system that sits
between message receipt and agent dispatch.

---

## Goal

Create a new `agents/command-queue.ts` module with:

1. **`CommandQueue`** class -- singleton per GatewayRouter instance
2. **`QueueEntry`** type -- `{ id, sessionId, channelId, message, mode, enqueuedAt, priority }`
3. **`QueueLane`** type -- `{ sessionId, entries: QueueEntry[], state: 'idle'|'running'|'draining' }`
4. **`enqueue()`** -- add message to appropriate lane, returns queue position
5. **`dequeue()`** -- remove and return next entry respecting priority + lane fairness
6. **`peek()`** -- view next without removing
7. **`drain(sessionId)`** -- flush all entries for a session (/reset, /stop)
8. **`status()`** -- return queue depth, lane count, oldest entry age

The queue must be per-GatewayRouter (not global) since multiple routers can
exist in cluster/scaled deployments.

---

## Step 1: Define types

Create `agents/command-queue-types.ts`:

```typescript
export type QueueMode = 'steer' | 'followup' | 'collect' | 'interrupt';

export interface QueueEntry {
  id: string; // uuid v4
  sessionId: string; // session this entry belongs to
  channelId: string; // origin channel (telegram, web, cli, api)
  message: IncomingMessage; // the original message payload
  mode: QueueMode; // how to deliver (steer/followup/collect/interrupt)
  priority: number; // 0-100, higher = runs first (interrupt = 100)
  enqueuedAt: number; // Date.now()
  debounceKey?: string; // for collect mode coalescing
}

export interface QueueLane {
  sessionId: string;
  entries: QueueEntry[];
  state: 'idle' | 'running' | 'draining';
  lastDequeuedAt: number;
}

export interface QueueConfig {
  maxConcurrent: number; // global lane concurrency cap (default 4)
  debounceMs: number; // coalesce window (default 500)
  cap: number; // max entries per lane (default 20)
  drop: 'summarize' | 'old' | 'new'; // when cap exceeded
  defaultMode: QueueMode; // default for new sessions (default 'steer')
  lockTimeoutMs: number; // session write lock acquire timeout (default 60000)
}

export interface QueueStatus {
  totalEntries: number;
  activeLanes: number;
  idleLanes: number;
  oldestEntryAge: number; // ms since oldest entry enqueued
  laneStatuses: Array<{
    sessionId: string;
    entries: number;
    state: string;
    oldestEntryAge: number;
  }>;
}
```

## Step 2: Create `agents/command-queue.ts`

```typescript
import { randomUUID } from 'node:crypto';
import type {
  QueueEntry, QueueLane, QueueConfig, QueueMode,
  QueueStatus, IncomingMessage
} from './command-queue-types';

const DEFAULT_CONFIG: QueueConfig = {
  maxConcurrent: 4,
  debounceMs: 500,
  cap: 20,
  drop: 'summarize',
  defaultMode: 'steer',
  lockTimeoutMs: 60000,
};

export class CommandQueue {
  private lanes: Map<string, QueueLane> = new Map();
  private config: QueueConfig;
  private globalRunning = 0;

  constructor(config?: Partial<QueueConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Enqueue a message into its session lane.
   * Returns the entry or null if dropped by cap policy.
   */
  enqueue(
    sessionId: string,
    channelId: string,
    message: IncomingMessage,
    mode?: QueueMode,
  ): QueueEntry | null {
    let lane = this.lanes.get(sessionId);
    if (!lane) {
      lane = {
        sessionId,
        entries: [],
        state: 'idle',
        lastDequeuedAt: 0,
      };
      this.lanes.set(sessionId, lane);
    }

    // Debounce: if last message for this session within debounceMs, merge
    // into a collect entry rather than creating a new one
    const effectiveMode = mode ?? this.config.defaultMode;
    if (effectiveMode === 'collect') {
      const existingCollect = lane.entries.find(
        e => e.mode === 'collect' && e.channelId === channelId
      );
      if (existingCollect && 
          Date.now() - existingCollect.enqueuedAt < this.config.debounceMs) {
        // Merge into existing collect entry (implementation: append to
        // message list or create combined prompt)
        // For now, update the message and bump timestamp
        existingCollect.message = this.mergeMessages(
          existingCollect.message, message
        );
        existingCollect.enqueuedAt = Date.now();
        return existingCollect;
      }
    }

    const entry: QueueEntry = {
      id: randomUUID(),
      sessionId,
      channelId,
      message,
      mode: effectiveMode,
      priority: effectiveMode === 'interrupt' ? 100 : 0,
      enqueuedAt: Date.now(),
      debounceKey: effectiveMode === 'collect' ? `${sessionId}:${channelId}` : undefined,
    };

    // Cap enforcement
    if (lane.entries.length >= this.config.cap) {
      switch (this.config.drop) {
        case 'old':
          lane.entries.shift(); // drop oldest
          break;
        case 'new':
          return null; // drop this one
        case 'summarize':
          // Merge last N entries into one summary entry
          this.summarizeLane(lane);
          break;
      }
    }

    lane.entries.push(entry);
    return entry;
  }

  /**
   * Dequeue the next entry respecting priority and lane fairness.
   * Returns null if no entries are runnable (global cap reached).
   */
  dequeue(): QueueEntry | null {
    if (this.globalRunning >= this.config.maxConcurrent) {
      return null;
    }

    // Find the highest-priority entry across all lanes
    // Interrupt entries always win; otherwise round-robin across ready lanes
    let bestEntry: QueueEntry | null = null;
    let bestLane: QueueLane | null = null;

    // First pass: look for interrupt entries
    for (const lane of this.lanes.values()) {
      if (lane.state === 'running' || lane.state === 'draining') continue;
      const interruptEntry = lane.entries.find(e => e.mode === 'interrupt');
      if (interruptEntry) {
        // Interrupt: abort the currently running turn for this session
        // This is handled by the caller (see prompt 03)
        lane.entries = lane.entries.filter(e => e.id !== interruptEntry.id);
        lane.state = 'running';
        lane.lastDequeuedAt = Date.now();
        this.globalRunning++;
        return interruptEntry;
      }
    }

    // Second pass: round-robin across idle lanes
    let oldestLane: QueueLane | null = null;
    let oldestTime = Infinity;

    for (const lane of this.lanes.values()) {
      if (lane.state === 'running' || lane.state === 'draining') continue;
      if (lane.entries.length === 0) continue;
      if (lane.lastDequeuedAt < oldestTime) {
        oldestTime = lane.lastDequeuedAt;
        oldestLane = lane;
      }
    }

    if (oldestLane && oldestLane.entries.length > 0) {
      const entry = oldestLane.entries.shift()!;
      oldestLane.state = 'running';
      oldestLane.lastDequeuedAt = Date.now();
      this.globalRunning++;
      return entry;
    }

    return null;
  }

  /**
   * Mark a lane as done (called when agent turn completes).
   */
  complete(sessionId: string): void {
    const lane = this.lanes.get(sessionId);
    if (lane) {
      lane.state = 'idle';
    }
    this.globalRunning = Math.max(0, this.globalRunning - 1);
  }

  /**
   * Drain all entries for a session (/reset, /stop, session end).
   */
  drain(sessionId: string): void {
    const lane = this.lanes.get(sessionId);
    if (lane) {
      lane.state = 'draining';
      lane.entries = [];
      this.globalRunning = Math.max(0, this.globalRunning - 1);
    }
    this.lanes.delete(sessionId);
  }

  /** Peek at next entry without removing. */
  peek(sessionId?: string): QueueEntry | undefined {
    if (sessionId) {
      const lane = this.lanes.get(sessionId);
      return lane?.entries[0];
    }
    // Return highest-priority across all lanes
    for (const lane of this.lanes.values()) {
      if (lane.entries.length > 0) return lane.entries[0];
    }
    return undefined;
  }

  /** Get queue status for monitoring. */
  status(): QueueStatus {
    const laneStatuses: QueueStatus['laneStatuses'] = [];
    let totalEntries = 0;
    let oldestAge = 0;
    const now = Date.now();
    let activeLanes = 0;
    let idleLanes = 0;

    for (const lane of this.lanes.values()) {
      totalEntries += lane.entries.length;
      if (lane.state === 'running') activeLanes++;
      else idleLanes++;

      const laneOldest = lane.entries.reduce(
        (min, e) => Math.min(min, now - e.enqueuedAt), Infinity
      );
      if (laneOldest !== Infinity && laneOldest > oldestAge) {
        oldestAge = laneOldest;
      }

      laneStatuses.push({
        sessionId: lane.sessionId,
        entries: lane.entries.length,
        state: lane.state,
        oldestEntryAge: laneOldest === Infinity ? 0 : laneOldest,
      });
    }

    return {
      totalEntries,
      activeLanes,
      idleLanes,
      oldestEntryAge: oldestAge,
      laneStatuses,
    };
  }

  private summarizeLane(lane: QueueLane): void {
    // Merge oldest entries into a summary entry
    // Implementation: take last cap/2 entries, create a single
    // "summary" entry that tells the agent "user sent N messages: ..."
    const toSummarize = lane.entries.splice(
      0, Math.max(1, lane.entries.length - Math.floor(this.config.cap / 2))
    );
    // Create a synthesized message summarizing the dropped ones
    const summaryContent = toSummarize
      .map(e => `[${e.channelId}] ${e.message.content}`)
      .join('\n');
    // Inject a summary as a new entry at the head
    lane.entries.unshift({
      id: randomUUID(),
      sessionId: lane.sessionId,
      channelId: 'system',
      message: {
        content: `[Queue: ${toSummarize.length} messages summarized]\n${summaryContent}`,
        timestamp: Date.now(),
      } as IncomingMessage,
      mode: 'followup',
      priority: 0,
      enqueuedAt: Date.now(),
    });
  }

  private mergeMessages(
    existing: IncomingMessage,
    incoming: IncomingMessage,
  ): IncomingMessage {
    return {
      ...incoming,
      content: `${existing.content}\n\n[+${Math.ceil((Date.now() - (incoming as any).timestamp || 0) / 1000)}s later]\n${incoming.content}`,
      timestamp: Date.now(),
    } as IncomingMessage;
  }
}
```

## Step 3: Wire into GatewayRouter

In `gateway/router.ts`:

1. Instantiate `CommandQueue` in the GatewayRouter constructor:

```typescript
import { CommandQueue } from '../agents/command-queue';

// In GatewayRouter class:
private commandQueue: CommandQueue;

constructor(...) {
  // ...
  this.commandQueue = new CommandQueue({
    maxConcurrent: parseInt(process.env.CARINA_QUEUE_MAX_CONCURRENT || '4'),
    debounceMs: parseInt(process.env.CARINA_QUEUE_DEBOUNCE_MS || '500'),
    cap: parseInt(process.env.CARINA_QUEUE_CAP || '20'),
    drop: (process.env.CARINA_QUEUE_DROP || 'summarize') as 'summarize' | 'old' | 'new',
    defaultMode: (process.env.CARINA_QUEUE_DEFAULT_MODE || 'steer') as QueueMode,
  });
}
```

2. Replace direct agent dispatch in `handleIncoming`:

```typescript
// OLD:
// await this.runAgentLoop(sessionId, message);

// NEW:
const entry = this.commandQueue.enqueue(
  sessionId, channelId, message, undefined // uses defaultMode
);
if (entry) {
  // Fire typing indicator
  this.sendTypingIndicator(sessionId, 'thinking');
  // Trigger queue processing
  this.processQueue();
}
```

3. Add `processQueue()` method that loops dequeuing and running:

```typescript
private async processQueue(): Promise<void> {
  let entry = this.commandQueue.dequeue();
  while (entry) {
    try {
      await this.runAgentLoop(entry.sessionId, entry.message, entry.mode);
    } catch (err) {
      this.logger.error(`Queue entry ${entry.id} failed`, err);
    } finally {
      this.commandQueue.complete(entry.sessionId);
    }
    entry = this.commandQueue.dequeue();
  }
}
```

4. On /reset and /stop, drain the session lane:

```typescript
handleReset(sessionId: string): void {
  this.commandQueue.drain(sessionId);
  // ... existing reset logic
}
```

## Step 4: Add CLI inspection command

In `cli/commands.ts`, add:

```
carina queue status          Show queue depth + lane status (JSON with --json)
carina queue drain <session>  Force-drain a session lane (admin only)
carina queue config           Show current queue configuration
```

## Testing

- Unit tests in `tests/agents/command-queue.test.ts`:
  - `enqueue` → entries appear in correct lane
  - `dequeue` → returns entries in priority then round-robin order
  - `maxConcurrent` → dequeue returns null when cap reached
  - `cap` → old entry dropped when `drop: 'old'`
  - `cap` → new entry rejected when `drop: 'new'`
  - `drain` → removes lane and all entries
  - `interrupt` entries dequeued first regardless of order
  - `collect` mode coalesces within debounce window
  - Multiple lanes → round-robin fairness across sessions

- Integration test in `tests/gateway/queue-integration.test.ts`:
  - Rapid messages from same session → debounced
  - /stop during agent turn → interrupt dequeued, agent aborted
  - Queue status accurate after enqueue+dequeue

---

## Existing Carina code to integrate with

- `gateway/router.ts` -- GatewayRouter class (565 lines). Add queue field + wire
- `agents/agent-runner.ts` -- accept QueueMode parameter
- `agents/session-manager.ts` -- register drain on session close
- `cli/commands.ts` -- command registry for `queue` commands
- `cli/registry.ts` -- register new CLI command group
- `config/schema.ts` -- add queue config keys to env schema
