# Gap 16 - Prompt 02: Session Write Locks, Debouncing, Caps & Drop Strategies

**Gap:** 24 Command Queue & Message Coordination
**Prompt number:** 02 of 03
**Name:** Session coordination -- write locks, debouncing, caps, drop strategies
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 01-queue-core.md (CommandQueue class must exist)

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

1. `agents/command-queue.ts` -- CommandQueue from prompt 01
2. `agents/session-manager.ts` -- session lifecycle
3. `gateway/router.ts` -- session creation and retirement
4. This README: `README.md`

---

## Context

The CommandQueue from prompt 01 handles lane assignment and basic enqueue/dequeue.
This prompt adds coordination primitives that prevent corruption:

1. **Session write locks** -- Only one agent turn can write to a session at a time.
   Without this, a steer-mode message could interleave output with the active turn.
2. **Debouncing** -- Rapid messages within `debounceMs` should be batched, not
   dispatched as separate turns.
3. **Queue caps** -- Prevent unbounded growth when a session floods.
4. **Drop strategies** -- What happens when the cap is hit (summarize/old/new).

---

## Goal

Extend `agents/command-queue.ts` with session coordination primitives:

### 1. Session Write Locks

```typescript
// In agents/session-lock.ts (new file)
export class SessionWriteLock {
  private locks: Map<string, { holder: string; acquiredAt: number; timeout: NodeJS.Timeout }> = new Map();
  private timeoutMs: number;
  private pendingResolvers: Map<string, Array<() => void>> = new Map();

  constructor(timeoutMs = 60000) {
    this.timeoutMs = timeoutMs;
  }

  /**
   * Acquire a write lock for a session.
   * Returns true if acquired, false if timeout expired waiting.
   * Throws if already held (shouldn't happen with queue serialization).
   */
  async acquire(sessionId: string, holderId: string): Promise<boolean> {
    if (this.locks.has(sessionId)) {
      const existing = this.locks.get(sessionId)!;
      if (existing.holder === holderId) return true; // re-entrant

      // Wait for release with timeout
      return new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
          this.cleanupWaiter(sessionId, resolve);
          resolve(false);
        }, this.timeoutMs);

        if (!this.pendingResolvers.has(sessionId)) {
          this.pendingResolvers.set(sessionId, []);
        }
        this.pendingResolvers.get(sessionId)!.push(() => {
          clearTimeout(timeout);
          resolve(true);
        });
      });
    }

    this.locks.set(sessionId, {
      holder: holderId,
      acquiredAt: Date.now(),
      timeout: setTimeout(() => this.forceRelease(sessionId), this.timeoutMs),
    });
    return true;
  }

  /** Release a write lock. Notifies pending waiters. */
  release(sessionId: string, holderId: string): void {
    const lock = this.locks.get(sessionId);
    if (!lock || lock.holder !== holderId) return;

    clearTimeout(lock.timeout);
    this.locks.delete(sessionId);

    // Notify first pending waiter
    const waiters = this.pendingResolvers.get(sessionId);
    if (waiters && waiters.length > 0) {
      const resolve = waiters.shift()!;
      resolve();
    }
  }

  /** Force-release (timeout safety valve). */
  forceRelease(sessionId: string): void {
    this.locks.delete(sessionId);
    const waiters = this.pendingResolvers.get(sessionId);
    if (waiters) {
      waiters.forEach(r => r());
      this.pendingResolvers.delete(sessionId);
    }
  }

  isLocked(sessionId: string): boolean {
    return this.locks.has(sessionId);
  }

  private cleanupWaiter(sessionId: string, resolve: () => void): void {
    const waiters = this.pendingResolvers.get(sessionId);
    if (waiters) {
      const idx = waiters.indexOf(resolve);
      if (idx >= 0) waiters.splice(idx, 1);
    }
  }
}
```

Wire into CommandQueue so `dequeue()` acquires the lock before returning an
entry, and `complete()` releases it.

### 2. Per-Session Config Overrides

Users can change queue behavior per session via `/queue` command. Add:

```typescript
// In command-queue.ts
private sessionOverrides: Map<string, Partial<QueueConfig>> = new Map();

setSessionConfig(sessionId: string, overrides: Partial<QueueConfig>): void {
  this.sessionOverrides.set(sessionId, overrides);
}

getSessionConfig(sessionId: string): QueueConfig {
  const overrides = this.sessionOverrides.get(sessionId) || {};
  return { ...this.config, ...overrides };
}
```

### 3. Typing Indicator Dispatch

Add a hook to fire typing indicators on enqueue (not on agent start):

```typescript
// In gateway/router.ts
private typingIndicator(sessionId: string, action: 'start' | 'stop'): void {
  // Dispatch to channel adapter
  const session = this.getSession(sessionId);
  const adapter = this.getChannelAdapter(session?.channelId);
  if (adapter?.sendTypingIndicator) {
    adapter.sendTypingIndicator(session.channelThreadId, action);
  }
}
```

Call `typingIndicator(sessionId, 'start')` in `enqueue()` when lane was previously
empty (first entry). Call `typingIndicator(sessionId, 'stop')` in `complete()`
when lane is now empty.

### 4. Stale Entry Eviction

Entries older than 5 minutes in an idle lane should be auto-evicted to prevent
memory leaks from abandoned sessions:

```typescript
// In CommandQueue, called periodically (every 60s)
evictStale(maxAgeMs = 300000): number {
  let evicted = 0;
  const now = Date.now();
  for (const [sessionId, lane] of this.lanes.entries()) {
    if (lane.state !== 'idle') continue;
    const before = lane.entries.length;
    lane.entries = lane.entries.filter(e => now - e.enqueuedAt < maxAgeMs);
    evicted += before - lane.entries.length;
    if (lane.entries.length === 0) {
      this.lanes.delete(sessionId);
    }
  }
  return evicted;
}
```

Register eviction via `setInterval` in GatewayRouter constructor.

---

## Testing

```typescript
// tests/agents/session-lock.test.ts
describe('SessionWriteLock', () => {
  it('acquires and releases');
  it('blocks concurrent acquires');
  it('notifies waiters on release');
  it('timeout force-releases after timeoutMs');
  it('re-entrant acquires return true');
});

// tests/agents/command-queue-coordination.test.ts
describe('Queue coordination', () => {
  it('acquires write lock on dequeue');
  it('releases write lock on complete');
  it('fires typing indicator on first enqueue');
  it('stops typing indicator when lane empties');
  it('evicts stale entries after maxAgeMs');
  it('session overrides change queue behavior');
});
```

---

## Existing Carina code to integrate with

- `agents/command-queue.ts` -- extend with lock + override methods
- `agents/session-manager.ts` -- session lifecycle hooks
- `gateway/router.ts` -- typing indicator dispatch
- `gateway/channels/adapters/` -- per-adapter typing indicator support
- `config/schema.ts` -- `CARINA_QUEUE_LOCK_TIMEOUT_MS`, `CARINA_QUEUE_STALE_EVICT_MS`
