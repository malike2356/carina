# Gap 24 - Command Queue & Message Coordination

**Gap:** 24
**Sprint:** 2
**Source:** OpenClaw docs (https://docs.openclaw.ai/concepts/queue)
**Goal:** Add a lane-aware FIFO command queue with steer/followup/collect/interrupt
  modes, debouncing, per-session queue overrides, and typing indicators.
  Carina currently has NO command queue -- messages dispatch directly
  to the agent loop with no coordination, debouncing, or priority management.

**Primary agent:** Claude Code
**Estimated hours:** 8-10 h total (across 3 prompts)
**Risk:** Medium. Touches core agent dispatch path. Additive architecture -- old
  path remains as fallback until queue is stable.
**Depends on:** Nothing. Standalone feature.

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

OpenClaw's command queue is a lane-aware FIFO system that sits between channel
message receipt and the agent loop. It provides four queue modes:

| Mode | Behavior |
|------|----------|
| `steer` | Inject into active run (default). Preempts the current agent turn with new context. |
| `followup` | Enqueue for later. Runs after the active turn completes. |
| `collect` | Coalesce into single turn. Multiple messages collapsed before agent sees them. |
| `interrupt` | Abort active run, run newest. For urgent overrides like /stop. |

Key features Carina needs:

1. **Lane-aware FIFO**: Per-session lane serialization + global lane with
   configurable concurrency cap (`maxConcurrent`, default 4).
2. **Debouncing**: `debounceMs` config (default 500ms) to batch rapid-fire messages.
3. **Queue caps**: `cap` config (default 20) with drop strategy (`summarize`,
   `old`, `new`).
4. **Per-session overrides**: `/queue steer|followup|collect|interrupt` command.
5. **Typing indicators**: Fire on enqueue, not on agent start.
6. **Session write locks**: Prevent concurrent writes to same session with
   configurable acquire timeout (60000ms default).
7. **Additional lanes**: `cron`, `cron-nested`, `nested`, `subagent` for
   background parallelism.

Carina's current dispatch path (gateway/router.ts `handleIncoming`) calls the
agent loop directly with no queue layer. Adding the queue gives:
- Better UX for rapid-fire messages (no interleaving)
- Priority handling for control commands (/stop, /reset)
- Natural batching for multi-message turns
- Protection against session write conflicts

---

## Build Order

```
01-queue-core.md        Queue data structures, enqueue/dequeue, lane assignment
02-session-coordination.md  Write locks, debouncing, caps, drop strategies
03-queue-modes-slash.md  Steer/followup/collect/interrupt logic + /queue command
```

Start with 01. 02 and 03 can run in parallel after 01 is done.

---

## Integration Points

- `gateway/router.ts` -- replace direct `agentLoop()` call with queue enqueue
- `agents/agent-runner.ts` -- agent loop must be queue-aware (accept queue mode)
- `agents/session-manager.ts` -- session write locks live here
- `cli/commands.ts` -- add `/queue` slash command
- `tui/chat-view.ts` -- typing indicators on queue enqueue

## Reference Files (OpenClaw source to study)

- OpenClaw `src/gateway/queue.ts` -- queue data structures and FIFO
- OpenClaw `src/gateway/queue-modes.ts` -- steer/followup/collect/interrupt
- OpenClaw `src/agents/session-lock.ts` -- session write locking
- OpenClaw `src/gateway/typing.ts` -- typing indicator dispatch

## Done When

- [ ] Messages from any channel enqueue into a per-session FIFO lane
- [ ] Global lane concurrency cap respects `maxConcurrent`
- [ ] Debouncing works (rapid messages within debounceMs are batched)
- [ ] Queue cap + drop strategy works (summarize/old/new)
- [ ] `/queue` slash command changes mode per session
- [ ] Typing indicators fire on enqueue, not on agent start
- [ ] Session write locks prevent concurrent writes
- [ ] Control commands (/stop, /reset) use `interrupt` mode by default
- [ ] Old direct-dispatch path removed or gated behind config flag
