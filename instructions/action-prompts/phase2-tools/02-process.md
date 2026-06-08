# Action: Process Management Tool (Standalone Carina)

## Goal
Implement a `process` tool that lets Carina poll, read, signal, and kill background processes - but only as a follow-on to the decision made in `01-terminal.md`, since this tool has nothing to manage if background mode is not built.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- **Hard dependency**: this entire spec assumes `01-terminal.md`'s background mode exists and produces `session_id`s that this tool then manages. Read `01-terminal.md` (in this same `action_prompts/phase2-tools/` directory) FIRST. If that prompt's step 3 concluded background mode should be deferred, this tool should be deferred with it - stop here and tell the user rather than building a process manager with nothing to process.
- The spec describes actions (`list`, `poll`, `log`, `wait`, `kill`, `write`, `submit`, `close`) that mirror exactly what you'd need to drive a long-lived interactive subprocess from a stateless tool-call interface. This is a real, coherent design - it is just designed for an agent with direct host process control, which is the architectural question `01-terminal.md` raises.
- Current state: Carina has no process registry of any kind (`grep -rn 'process_registry\|ProcessRegistry\|session_id.*pid' src/` returns nothing). `shellExecTool` runs one command to completion inside a throwaway container and returns - there is no concept of a process outliving its tool call.

## Files to create (only after 01-terminal.md's decision is made and background mode is approved)
- `src/tools/process.ts` - the tool, sharing `process-registry.ts` with whatever `01-terminal.md` produces
- `src/tools/process.test.ts`

## Step-by-step

1. Confirm `01-terminal.md`'s decision before writing anything. If background mode was deferred, write a one-paragraph note explaining why this tool is also deferred and stop - do not build a registry-management tool speculatively for a registry that doesn't exist.

2. If background mode was approved, design the registry shape collaboratively with the terminal tool (do not let each tool define its own `Map<string, ProcessState>` - that produces two sources of truth that will drift):
   ```ts
   interface ProcessState {
     sessionId: string;
     pid: number;
     command: string;
     status: 'running' | 'exited' | 'killed' | 'error';
     startedAt: Date;
     exitCode?: number;
     outputBuffer: string[];  // circular buffer, capped at 1000 lines
     stdin?: NodeJS.WritableStream;
   }
   ```
   Export this from a shared `src/tools/process-registry.ts` that both `shell.ts`/`process.ts` import.

3. Implement each action as a thin wrapper around registry operations - keep `process.ts` itself under ~150 lines by pushing the actual process-control logic (signal escalation, buffer pagination, EOF handling) into the registry module:
   - `list`: map registry entries to `{ session_id, pid, command, status, uptime }`
   - `poll`: return status plus only the output appended since the last poll for that session (track a per-session read cursor)
   - `log`: paginate the circular buffer with `offset`/`limit`, defaulting to the last 200 lines
   - `wait`: `Promise.race` between process exit and the timeout; return full output on exit, partial + a `timedOut: true` flag on timeout
   - `kill`: send `SIGTERM`, wait a grace period (document the chosen value as a named constant), escalate to `SIGKILL` if the process is still alive
   - `write`/`submit`/`close`: write to the registered stdin stream (`submit` appends `\n`, `close` calls `.end()`)

4. Implement auto-cleanup: a single `setInterval` (mirror the `heartbeatInterval` pattern from `src/index.ts` - one timer, not one per process) that sweeps the registry every minute and removes `exited`/`killed`/`error` entries older than 5 minutes. Clear this interval in `shutdown()`.

5. Wire `reportToolCall` (from `src/security/scout-client.ts`) into every action - the spec requires Scout audit logging, and this tool is exactly the kind of capability (arbitrary process control) that an audit trail exists to cover. Mirror how `shellExecTool` logs to `data/logs/shell.log` via `logShell`, but also push to Scout, matching the pattern other dangerous tools use (check `enforceToolPolicy`'s call sites for the canonical "how do dangerous tools report to Scout" answer).

6. Write `src/tools/process.test.ts` (Vitest):
   - Mock the registry; test each action maps params to the correct registry call and response shape
   - Test `kill` escalates from `SIGTERM` to `SIGKILL` when the process doesn't exit within the grace period (use `vi.useFakeTimers()`)
   - Test `poll` returns only new output since the last poll, not the full buffer each time
   - Test the cleanup sweep removes old exited entries but leaves running ones and recently-exited ones alone

## Expected behavior
- `process: list` shows all active background processes with accurate uptime.
- `process: poll {session_id}` returns incremental output, not a growing full-buffer dump.
- `process: kill {session_id}` reliably terminates processes, escalating when needed.
- Exited processes disappear from `process: list` five minutes after completion, automatically.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/process.test.ts
pnpm test
pnpm build
```

## Dependencies
- `01-terminal.md` must be completed first, with background mode approved and implemented - this tool is inert without it
- Shared `process-registry.ts` module (do not duplicate the registry between the two tools)
