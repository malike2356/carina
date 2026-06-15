# Action: Terminal Tool - Extend shell-exec (Standalone Carina)

## Goal
Extend Carina's existing `shell-exec` tool to support working-directory and timeout parameters as the spec requires for foreground use, and make a deliberate, documented decision about background/PTY modes rather than bolting them on as a side effect of "matching the spec."

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- The spec (`01-terminal.md` in `prompt_description/`) was written for a different agent product (it imports `from hermes_tools import ...` and references `~/.hermes/`) whose terminal tool runs commands directly on the host with full background/PTY process control. Carina's actual terminal tool, `src/tools/shell.ts` (`shellExecTool`, 49 lines), is deliberately narrower: it shells out through `runInSandbox()` (`src/tools/sandbox.ts`) into a **network-disabled, read-only, memory-capped Docker container**, is marked `dangerous: true` and `requiresConfirmation: true`, and refuses to run as root. That is not an oversight - it is the security model. Read both files in full before changing anything.
- **This is the central tension to resolve before writing any code**: the spec's background mode ("processes survive tool call boundaries", "session_id tracked in a registry", "for servers/watchers: background=true without notify, never exits") and PTY mode ("Claude Code, Codex, Python REPL, any ncurses app... do NOT use vim/nano without pty=true") describe **persistent, interactive, host-shaped process control** - the opposite of "spin up a throwaway container, run one command, tear it down." Implementing them as specified would mean either (a) breaking out of the sandbox to give Carina long-lived host processes (a major security posture change for an agent whose own security layer - `egress-filter.ts`, `tool-policy.ts` - assumes tools are bounded, single-shot operations), or (b) building PTY/background support *inside* Docker containers that persist across tool calls (a much larger subsystem: container lifecycle management, output buffering, stdin piping into a running container - effectively reimplementing `docker exec -it` orchestration from Node).
- Do not silently pick option (a). If Cursor needs to make this decision, it must surface it to the user explicitly and get a decision before writing code that grants persistent host-level process control to an LLM-driven agent.

## Files to verify / extend
- `src/tools/shell.ts` (`shellExecTool`)
- `src/tools/sandbox.ts` (`runInSandbox`, `SandboxOptions`)

## Files to create (only if the user confirms background/PTY mode should be built - see step 3)
- `src/tools/process-registry.ts` (shared with `02-process.md` - read that prompt before building this; the two tools must share one registry, not each invent their own)
- `src/tools/shell.test.ts` additions for the new parameters

## Step-by-step

1. **Extend foreground mode first** - this is safe, low-risk, and matches both the spec and the existing sandbox model:
   - Add `workdir` (optional string) and `timeout` (optional int, default keeps `TIMEOUT_MS = 30_000`, cap at the spec's suggested 600s) parameters to `shellExecTool.parameters`.
   - Thread `workdir` through to `runInSandbox` as a new `SandboxOptions.workdir` field; mount or `cd` into it inside the container command (check how `docker run` mounts work here - currently there's no volume mount at all, so `workdir` may require adding a bind mount, which has its own security implications: it grants the sandboxed process filesystem access to the host path. Use `isSafePath`/`isBlockedSystemWrite` from `src/tools/path-utils.ts` to validate `workdir` before mounting it, exactly as `file.ts` validates paths).
   - Cap `timeout` at the spec's stated maximum (600s) and never let a caller-supplied value exceed it.
   - Add an `output capped at 50KB` truncation to the returned `stdout`/`stderr` (the spec's stated limit; `runInSandbox` currently caps at `maxBuffer: 1024*1024` which is larger - tighten the tool-level response, not the exec-level buffer, so truncation messaging stays consistent with `file.ts`'s `[truncated: ...]` pattern).

2. **Do not implement `pty: true` as a parameter that silently does nothing or silently breaks the sandbox.** If you add the parameter to the schema before the underlying capability exists, the LLM will call it expecting interactive behaviour and get silent failure - worse than not offering it. Either build it for real (see step 3) or omit it from the schema entirely and note its absence in your completion summary.

3. **Surface the background/PTY decision to the user** rather than choosing for them. Summarise the tradeoff plainly: building these as specified means Carina gets the ability to start processes that outlive a single tool call and persist in memory across turns - a meaningful expansion of what an LLM-driven agent can do unsupervised on this host. Ask: should this be built (a) inside ephemeral Docker containers (more engineering, preserves the sandbox boundary, requires solving container-exec-with-persistent-stdin from Node), (b) as direct host subprocesses gated by a new, more restrictive confirmation/allowlist layer (less engineering, larger blast radius, needs new Scout-side controls), or (c) deferred entirely (simplest, but `02-process.md` then has nothing to manage and should also be deferred). Do not default to (b) just because it's the path of least resistance - it is also the path of greatest risk for an internet-facing agent.

4. **If and only if the user picks (a) or (b)**, design `process-registry.ts` jointly with `02-process.md`'s requirements (status enum `running|exited|killed|error`, circular output buffer capped at 1000 lines, 5-minute auto-cleanup of exited entries, `Map<session_id, ProcessState>`) before writing either tool, so both tools consume the same shape rather than each inventing one.

5. Update `src/tools/shell.test.ts`:
   - Test `workdir` is rejected when it fails `isSafePath`/`isBlockedSystemWrite`
   - Test `timeout` is clamped to the maximum even when a caller requests more
   - Test the 50KB output truncation produces the `[truncated: ...]` message format consistent with `file.ts`

## Expected behavior
- `shell-exec(command, workdir, timeout)` runs in the existing sandbox with the new parameters honoured and validated, output capped and truncation-flagged.
- No half-built `background`/`pty` parameters exist in the tool schema that silently no-op.
- A clear, written decision exists (in your completion summary, or as a short doc if the user wants one) about whether/how background and PTY modes will be built, made WITH the user rather than assumed.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/shell.test.ts
pnpm test
pnpm build
```

## Dependencies
- Docker available on the host (`checkDocker()` in `sandbox.ts` already handles the unavailable case gracefully)
- `02-process.md` is blocked on the decision made in step 3 here - do not build it first
- If background/PTY mode is approved: `node-pty` would need to be added to `package.json` (not currently a dependency - confirm the maintenance status and native-binary build requirements before adding it, since native modules complicate Docker image builds)
