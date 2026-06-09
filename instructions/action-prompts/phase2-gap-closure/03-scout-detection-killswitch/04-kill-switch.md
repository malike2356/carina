# Action: Complete the Kill Switch (ARM/TRIGGER States, Phased Shutdown, Server-Only Disarm)

## Goal
Bring the EXISTING kill-switch endpoint up to the spec's full behavior: explicit ARMED/TRIGGERED states, the phased shutdown sequence (0-1s reject new requests, 1-3s SIGTERM, 3-5s SIGKILL + persist + audit, 5s+ alert), an immutable audit record, and a deliberately-impossible-to-disarm-remotely design (`carina scout disarm` is a server-side CLI command only).

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/03-scout-detection-killswitch/04-kill-switch.md`
- **A kill endpoint already exists; gap-closure, not greenfield.** Read these first:
  - `console.labyrinthscout.com/src/api/kill.ts` (33 lines; the FULL file is reproduced in your context already; it is short): currently `POST /:instanceId` validates a reason and calls `suspendInstance(instanceId, reason)` from `lib/instance-control.ts`, returning `{ ok, instance_id, status }`
  - `console.labyrinthscout.com/src/lib/instance-control.ts`; read this in full; it is where `suspendInstance` and `validateKillReason` live, and is almost certainly where the actual stop logic resides
  - `console.labyrinthscout.com/src/api/block-session.ts` (87 lines); likely a related per-session stop mechanism; read it to see whether it overlaps with what the spec wants for "stop all active chat sessions"
  - `core.carinaai.uk/src/security/kill-switch-listener.ts` (227 lines); the AGENT-side listener that reacts to a kill-switch trigger; read this to understand how the agent currently learns it has been killed and what it does in response (this is likely most of "Phase 2" and "Phase 3" of the spec's shutdown sequence already)
- The gap is most likely:
  1. The CURRENT `kill.ts` operates per-instance (`POST /:instanceId`); the spec wants a GLOBAL kill switch that stops ALL agents across ALL tenants (`POST /api/admin/scout/killswitch/trigger`, no instance ID). Determine whether the existing per-instance endpoint is a building block for the global one (loop over all instances) or a genuinely different feature that must coexist alongside a new global endpoint.
  2. Explicit ARMED/TRIGGERED state machine and a `GET .../killswitch/status` endpoint; confirm with `grep -n "armed\|triggered\|ARMED\|TRIGGERED" kill.ts instance-control.ts`
  3. The "cannot be disarmed remotely; requires `carina scout disarm` on the server" design; confirm whether any disarm endpoint exists at all (it should NOT, by design; if one does, the spec requires it to return 403)
  4. The phased timing (sub-second reject, 1-3s SIGTERM, 3-5s SIGKILL) and the `stop_duration_ms` measurement in the audit record
- Conventions: TypeScript strict, no emojis/em-dashes, every new module gets a `*.test.ts`.

## Files to create
```
console.labyrinthscout.com/src/killswitch/
  global-kill-switch.ts; Global ARM/TRIGGER state machine; orchestrates stopping ALL instances (built on top of existing suspendInstance, not a parallel stop mechanism)
  graceful-shutdown.ts; Phase 1-4 timing orchestration (reject → SIGTERM → SIGKILL → persist+audit → alert)
  kill-switch-audit.ts; Immutable audit record writer matching the spec's exact JSON shape (lines 109-125)
  __tests__/
    global-kill-switch.test.ts
    graceful-shutdown.test.ts
    kill-switch-audit.test.ts
console.labyrinthscout.com/src/api/
  killswitch-status.ts; GET /api/admin/scout/killswitch/status, POST .../trigger, POST .../disarm (returns 403 always)
core.carinaai.uk/bin/
  scout-disarm.ts; `carina scout disarm --reason "..." --admin "..."` server-side-only CLI command
```

## Files to modify
- `console.labyrinthscout.com/src/lib/instance-control.ts`; read in full; if `suspendInstance` already implements a graceful per-instance stop, `global-kill-switch.ts` should call it in a loop over all active instances rather than reimplementing shutdown logic
- `console.labyrinthscout.com/src/api/kill.ts`; keep the existing per-instance endpoint working (it may serve a different admin use case; "suspend this one tenant"); do not remove it; add the new global endpoint as a SEPARATE router registered at a different path
- `core.carinaai.uk/src/security/kill-switch-listener.ts`; read in full (227 lines); confirm it already implements the agent-side reaction to a kill signal (rejecting new tool calls, ending active conversations gracefully, persisting state); extend it ONLY for gaps the spec requires that it does not yet cover (e.g. the exact user-facing message `"Emergency stop activated. Session ending."` or `"Carina is temporarily unavailable."`)
- `console.labyrinthscout.com/src/server.ts`; register the new `killswitch-status` router

## Step-by-step
1. Read `lib/instance-control.ts` in full; this is the actual stop mechanism behind the existing `kill.ts`. Note exactly what `suspendInstance` does (does it send signals to processes? mark a DB row? both?).
2. Read `kill-switch-listener.ts` in full (227 lines; substantial). Map its behavior against the spec's four phases (lines 28-46): does it already reject new tool calls immediately, send SIGTERM-equivalent signals, persist state, and notify users with the documented messages? List what it already covers and what it does not.
3. Read `block-session.ts` (87 lines) to see if it overlaps with "stop all active chat sessions"; if it provides per-session stop, `global-kill-switch.ts` can call it in a loop rather than reimplementing.
4. Create `global-kill-switch.ts`: an explicit state machine with `ARMED`/`TRIGGERED` states (default `ARMED`), a `trigger(adminEmail, reason)` method that (a) immediately flips state to `TRIGGERED` and starts rejecting new requests, (b) iterates all active instances calling the existing `suspendInstance`/`block-session` mechanisms, (c) records `agents_stopped` and `stop_duration_ms`. Persist the state in the DB (follow the existing migration style; check `migrations.ts`) so a server restart does not silently reset it to ARMED.
5. Create `graceful-shutdown.ts`: orchestrates the four-phase timing from the spec (immediate reject, 1-3s soft stop, 3-5s hard stop, 5s+ alerts) using the signals/mechanisms already present in `instance-control.ts` and `kill-switch-listener.ts`; this module is the TIMING WRAPPER, not a new stop mechanism.
6. Create `kill-switch-audit.ts`: writes the exact JSON shape from spec lines 109-125 (`event`, `timestamp`, `triggered_by`, `reason`, `agents_stopped`, `stop_duration_ms`, `affected_tenants`, `alerts_sent`) to the immutable audit log (read spec 04-audit-log-compliance's append-only table design; if that spec has landed, write to the same `audit_log` table; if not, use whatever existing audit/event table this codebase has, found via `grep -n "CREATE TABLE.*audit\|CREATE TABLE.*event" migrations.ts`).
7. Create `killswitch-status.ts` API router: `GET /status` returns `{ armed, triggered, triggered_by, agents_active }`; `POST /trigger` requires admin password + reason, calls `global-kill-switch.trigger()`; `POST /disarm` ALWAYS returns `403` with the exact message `"Disarm requires server access. SSH: carina scout disarm"`; this is a deliberate design constraint, not a missing feature to "complete."
8. Create `scout-disarm.ts`: a server-only CLI command (`carina scout disarm --reason "..." --admin "..."`) that flips the global state back to `ARMED` and writes its own audit record. This must NOT be reachable via any HTTP endpoint; it only runs via direct server/SSH access, matching the spec's security model exactly.
9. Wire `killswitch-status` into `server.ts`'s router registration.
10. Extend `kill-switch-listener.ts` only for gaps found in Step 2; e.g. if it does not yet send the exact message `"Carina is temporarily unavailable."` for new requests during Phase 1, add it; if it already does something equivalent, leave it and just confirm wording matches.

## Expected behavior
- `GET /api/admin/scout/killswitch/status` returns `{ armed: true, agents_active: 47 }` before triggering
- `POST /api/admin/scout/killswitch/trigger {"password": "***", "reason": "Test trigger"}` stops all 47 agents within ~2.3 seconds, returns `{ triggered: true, agents_stopped: 47, duration_ms: 2300 }`, and the status flips to `{ armed: false, triggered: true, triggered_by: "<admin>" }`
- `POST /api/admin/scout/killswitch/disarm` ALWAYS returns 403 with `"Disarm requires server access. SSH: carina scout disarm"` regardless of who calls it
- Running `carina scout disarm --reason "Threat resolved" --admin "<email>"` on the server (and ONLY there) re-arms the switch and writes its own audit entry
- CRITICAL alerts are sent to Telegram, email, and SMS within seconds of triggering (via the existing `alertDispatcher`; confirm this wiring, do not build a parallel alert path)

## Test
- `global-kill-switch.test.ts`: state transitions ARMED → TRIGGERED are correct and irreversible via any in-process method other than the disarm CLI path; `agents_stopped`/`stop_duration_ms` are measured correctly (use a mock instance list and fake timers)
- `graceful-shutdown.test.ts`: the four phases fire in the documented order and timing windows (fake timers; do not sleep)
- `kill-switch-audit.test.ts`: the written record matches the spec's JSON shape exactly
- API test: `POST .../disarm` returns 403 with the exact message string, under every auth condition (including as an admin; this is intentional)
- Run `pnpm test -- killswitch global-kill-switch graceful-shutdown` and confirm all pass

## Dependencies
- Read `instance-control.ts` and `kill-switch-listener.ts` FULLY before writing any new shutdown logic; most of the actual stopping mechanism likely already exists; this prompt's job is to wrap it in the global ARM/TRIGGER state machine and timing/audit contract the spec requires
- Spec 04-audit-log-compliance.md's immutable `audit_log` table is the natural home for `kill-switch-audit.ts` records if it has landed; otherwise use the existing event table
- Spec 02-alerting.md's `alertDispatcher` for CRITICAL notification delivery; reuse, do not duplicate
