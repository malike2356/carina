# Prompt: Build execute-code Tool (Carina Tool-Calling Bridge)

## What to build

`src/tools/execute-code.ts` does not exist. The gap analysis (Section D, tool-17-execute-code.md) confirms this. Build it as specified in `instructions/action-prompts/tool-17-execute-code.md` (the authoritative spec - read it in full before writing anything).

The execute function in the existing `src/tools/code.ts` is one-directional: code goes in, `{ stdout, stderr, exitCode }` comes out. This tool adds a bidirectional bridge so a Python or JS script running inside the Docker sandbox can call back into Carina's tool registry mid-execution.

## What already exists - read all of these first

- `src/tools/code.ts` - existing one-directional code exec (49 lines). Read fully.
- `src/tools/sandbox.ts` - Docker sandbox runner (130 lines). Read fully.
- `src/tools/registry.ts` - `ToolRegistry.get(name)` / `.list()` (42 lines). Read fully.
- `src/tools/path-utils.ts` - `expandPath`, `isSafePath`, `isBlockedSystemWrite`. Any path the bridge exposes must go through these.
- `src/tools/code.test.ts` - DOES NOT EXIST. Create it.

## Bridge design to implement

Use a file-based request/response protocol (not sockets). Each execution gets a temp directory (e.g. `data/code-exec/{uuid}/`) bind-mounted into the container at `/bridge`.

**Flow:**
1. Python script writes `{call_id}.request.json` with `{ tool, params }` to `/bridge`.
2. Node side watches the directory, reads the request, calls `registry.get(tool).execute(params)`, writes `{call_id}.response.json` with `{ result }` or `{ error }`.
3. Python script polls for the response file and returns the result as a normal function return value.

Inject a `carina_tools.py` module alongside the user script so `from carina_tools import read_file, search_files, shell_exec` works as plain functions.

Three built-in helpers are pure Python (no bridge round-trip): `json_parse(text)`, `shell_quote(s)`, `retry(fn, max_attempts=3, delay=2)`.

## Limits to enforce on the Node side

- 5-minute overall timeout (pass through to `runInSandbox`)
- 50 tool calls per script maximum; once exceeded write `{ error: 'tool call limit exceeded' }` to the response file so the script fails fast
- 50KB stdout cap with `[truncated: ...]` suffix, consistent with `fileReadTool`
- Bridge's `shell_exec` calls must NOT accept `background` or `pty` params regardless of what `shellExecTool` accepts in its normal path

## Docker-unavailable error message

The current `sandbox.ts` line 113 produces: `'Python execution requires Docker. Install Docker or use shell-exec with CARINA_DIRECT_SHELL=true to run python3 directly.'` This is only for Python. When Docker is unavailable for ANY language, the error should include the CARINA_DIRECT_SHELL alternative. Make the unavailable-Docker error path consistent across all languages in `sandbox.ts`.

## Security check required

Bridged tool calls invoke `tool.execute(params)` directly. Confirm whether this bypasses `enforceToolPolicy` / `needsConfirmation` checks. If it does, route bridged calls through the same policy gates. Add a test that verifies dangerous-tool calls via the bridge are NOT silently bypassed.

## Files to create or modify

- `src/tools/execute-code.ts` - new file; the bridge-aware executor
- `src/tools/code.ts` - extend to call execute-code.ts for the bridge path, or factor shared logic
- `src/tools/sandbox.ts` - add `workdir` bind-mount to `SandboxOptions` if not already there; fix Docker-unavailable error consistency
- `src/tools/code.test.ts` - create (Vitest, does not currently exist)
- `src/tools/index.ts` - register the new tool

## Tests to write in code.test.ts (action prompt specifies 10)

1. Language auto-detection (`detectLanguage`) on Python and JS samples
2. Bridge: mock registry, simulate `.request.json` appearing, confirm tool called and `.response.json` written correctly
3. Bridge: unknown tool name returns error response instead of throwing
4. 50-tool-call limit: servicing stops and error response written
5. Safety policy: dangerous-tool call via bridge triggers same confirmation gate as direct call
6. `shell_exec` via bridge rejects `background` param even if underlying tool accepts it
7. `shell_exec` via bridge rejects `pty` param
8. Docker unavailable: returns `{ error }` with clear message pointing to CARINA_DIRECT_SHELL
9. 50KB stdout cap: output truncated with `[truncated: ...]` suffix
10. Bridge mount directory is cleaned up after execution completes or fails

## Run after building

```bash
cd core.carinaai.uk
pnpm vitest run src/tools/code.test.ts
pnpm test
pnpm build
```

## Dependencies

- Docker available on host (existing `checkDocker()` handles unavailable case)
- `search-files` and `patch` tools exist (they do: `src/tools/search-files.ts`, `src/tools/patch.ts`) so bridge wrappers for them work immediately
