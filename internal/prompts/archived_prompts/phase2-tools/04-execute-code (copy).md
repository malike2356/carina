# Action: execute-code Tool - Add Tool-Calling Bridge (Standalone Carina)

## Goal
Extend Carina's existing `code-exec` tool so that sandboxed Python scripts can call back into Carina's own tools (`file-read`, `file-write`, `search-files`, `patch`, `shell-exec`) - turning "run one script" into "programmatically orchestrate Carina's toolset from inside a loop."

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest.
- The spec describes a Python-side import bridge (`from hermes_tools import read_file, write_file, ...`) that lets a sandboxed script call Carina's tools as plain functions, with the actual execution happening back on the Node side ("Tool calls are serialized: script -> tool -> result -> script"). This is the single most architecturally significant new capability in this batch of prompts: it requires a working **bidirectional** channel between an isolated, network-disabled Docker container and the Node process holding the live `ToolRegistry`.
- The existing `codeExecTool` (`src/tools/code.ts`, 49 lines, read in full) is one-directional: code goes in, `{ stdout, stderr, exitCode }` comes out, via `runCodeInSandbox` -> `runInSandbox` -> a single `docker run ... sh -c '...'`. There is no mechanism for the running container to call back out mid-execution. Building one means either (a) a long-lived container with a request/response pipe (stdin/stdout framing, or a Unix socket bind-mounted in), or (b) the script writes "tool call requests" to a file the host polls, runs the tool, writes results back, and the script polls for them - clunky but achievable without container lifecycle changes.
- Read `src/tools/sandbox.ts` (130 lines) and `src/tools/code.ts` (49 lines) fully - they are short. Also read `src/tools/registry.ts` (42 lines) to understand `ToolRegistry.get(name)`/`.list()`, the thing the bridge needs to reach into.
- Conventions: functions under ~20 lines, classes under ~200 lines, Vitest, no em dashes/emojis, `.js` import specifiers.

## Files to modify
- `src/tools/code.ts` - add the bridge-aware execution path
- `src/tools/code.test.ts` (does not exist - create it; `code.ts` currently has zero test coverage, which is itself worth flagging: a tool that executes arbitrary code in a sandbox is exactly the kind of code that should have tests)
- `src/tools/sandbox.ts` - extend `runCodeInSandbox`/add a bridge-aware variant if the chosen design needs container lifecycle changes

## Step-by-step

1. **Pick the simpler bridge design first and prove it works before reaching for anything more elaborate**: a file-based request/response protocol over a bind-mounted directory.
   - Mount a per-execution temp directory (e.g. `data/code-exec/{uuid}/`) into the container at a fixed path (e.g. `/bridge`)
   - The injected `hermes_tools`-equivalent Python module (name it something Carina-appropriate, e.g. `carina_tools`, since `hermes_tools` is the other product's branding) writes a JSON request file (`{call_id}.request.json`: `{ tool: 'file-read', params: {...} }`) and polls for `{call_id}.response.json`
   - The Node side watches the directory (`fs.watch` or a short poll loop bounded by the script's overall timeout), and when a request file appears: looks up the tool in `registry`, calls `tool.execute(params)`, writes the result to the response file
   - This avoids container lifecycle surgery entirely - `docker run` still runs to completion in one shot, but now the script inside it can "pause" on a poll loop while the host services its requests
   - **Document the latency cost honestly**: file-based polling adds tens-to-hundreds of milliseconds per tool call. For the spec's stated "max 50 tool calls per script" this is entirely acceptable; do not over-engineer toward a socket-based design to shave latency nobody asked for.

2. Generate the Python bridge module (`carina_tools.py`) as a string template injected alongside the user's script (write it to the same temp directory, the script does `import carina_tools` or `from carina_tools import read_file, ...` - match whichever the spec's example shows: `from hermes_tools import read_file, write_file, search_files, patch, terminal`, renamed to your module). Each function:
   - Writes the request file with a fresh `call_id`
   - Polls for the response file (sleep-and-check loop, bounded by a per-call timeout - document the constant)
   - Parses and returns the JSON result, or raises a Python exception carrying the tool's error message if the result is an error object

3. Implement the three "built-in helpers" as pure Python (no bridge round-trip needed - they're local utilities):
   - `json_parse(text)`: `json.loads(text, strict=False)`
   - `shell_quote(s)`: `shlex.quote(s)`
   - `retry(fn, max_attempts=3, delay=2)`: a small retry-with-backoff wrapper
   These are simple enough to write directly into the injected module string; no need for a separate file.

4. Enforce the spec's limits on the Node side, where they're actually enforceable (a sandboxed script cannot be trusted to enforce its own limits):
   - 5-minute overall timeout (pass through to `runInSandbox`'s `timeout`)
   - 50KB stdout cap (mirror `fileReadTool`'s truncation messaging)
   - **Max 50 tool calls per script**: track a counter on the Node side (increment per serviced request file), and once it's exceeded, stop servicing new requests and let the script's poll loops time out naturally (or write an explicit "limit exceeded" error response so the script fails fast and clearly rather than hanging until its own timeout)
   - `terminal()` is foreground-only inside scripts (no `background`/`pty` params) - when wiring `shell-exec` into the bridge, strip or reject those params regardless of what `01-terminal.md` eventually builds for the top-level tool, per this spec's explicit constraint

5. Pass the active session's working directory through (`workdir` from the session, per the spec: "Working directory matches the session") - reuse whatever `workdir` resolution `01-terminal.md` establishes for `shell-exec`, do not invent a second mechanism.

6. **Security review before shipping**: this bridge effectively gives sandboxed code access to the full power of Carina's tool registry - including, depending on what's registered, `shell-exec`, `file-write`, `email-send`. A malicious or confused script could now chain `search-files` -> `file-read` -> `email-send` entirely inside a 5-minute Python loop with no per-step confirmation gate (the existing `needsConfirmation`/`requiresConfirmation` checks are designed around single, user-visible tool calls - confirm whether they still fire correctly when invoked via the bridge, or whether the bridge silently bypasses them). If they would be bypassed, that is a real gap to close: route bridged tool calls through the same `enforceToolPolicy`/confirmation pipeline as direct calls, not around it.

7. Write `src/tools/code.test.ts` (Vitest, this file does not currently exist):
   - Test language auto-detection (`detectLanguage`) against representative Python and JS samples
   - Test the bridge: mock the registry, simulate a request file appearing, confirm the correct tool is invoked with correct params and the response file is written with the correct shape
   - Test the 50-tool-call limit halts servicing and surfaces a clear error
   - Test that `needsConfirmation`/`requiresConfirmation` gates are NOT bypassed for bridged calls to dangerous tools (this is the test that would have caught the gap in step 6, if it exists)
   - Test `shell-exec` calls through the bridge reject `background`/`pty` params even if the underlying tool would otherwise accept them

## Expected behavior
- A Python script run via `code-exec` can `from carina_tools import read_file, search_files` and use them as ordinary functions, with results flowing back from Carina's real tool registry.
- Dangerous bridged tool calls still go through the same confirmation/policy checks as direct calls - the bridge is not a backdoor around existing safety gates.
- Scripts respect the 50-call ceiling, 5-minute timeout, and 50KB output cap, all enforced from the Node side where a script cannot subvert them.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/code.test.ts
pnpm test
pnpm build
```
Manual check:
```
In a Carina session: "Run a Python script that searches src/ for TODO comments and reads the first 5 lines of each matching file"
```

## Dependencies
- `03-file-system.md` (the bridge's `search-files`/`patch` functions are inert without those tools existing)
- `01-terminal.md` (the bridge's `terminal()` function wraps `shell-exec`; its `workdir` resolution should match)
- Docker (the existing sandbox requirement - no new infrastructure dependency for the file-based bridge design)
