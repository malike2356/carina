# Cursor Task: Fix and harden terminal (#10) tool in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are going through all 27 Hermes tools one by one. Tools #18-21 and #19-20 are
confirmed working (memory, todo, session-search, clarify). This task covers tool #10
`terminal` (the `shell-exec` tool in Carina).

Read these files in full before touching anything:
- `src/tools/shell.ts` (the tool implementation)
- `src/tools/sandbox.ts` (Docker sandbox + fallback logic)
- `src/tools/path-utils.ts` (isSafePath, expandPath, etc.)
- `src/infrastructure/sandbox-session.ts` (session-persistent container)
- `src/tools/shell.test.ts` (existing tests - do not delete any)
- `src/tools/process-registry.ts` (background process handling)
- `src/tools/process.ts` (process management tool - read-only, do not change)

Do NOT modify any file you have not read first.
Do NOT touch `src/tools/process.ts` or `src/tools/process-registry.ts`.

---

## What terminal is supposed to do (Hermes behaviour)

In Hermes, `terminal` runs shell commands on the host system with full access to
installed tools (node, npm, git, python, etc.), the filesystem, and the network.
It supports foreground commands, background processes, and working directory changes.

Carina's `shell-exec` tool defaults to a Docker sandbox (`alpine:latest`,
`--network=none`, `--read-only`). This makes it nearly useless for real operator
tasks: npm, git, pip, and any file-writing operation all fail silently or with
cryptic errors.

The fix is not to remove Docker - it is a valid option for untrusted code. The fix
is to add a **direct shell mode** controlled by the `CARINA_DIRECT_SHELL=true`
environment variable, and to fix a Docker workdir argument bug that breaks even
the Docker path.

---

## Bugs and fixes required

### Fix 1: Docker workdir argument is malformed (bug in sandbox.ts)

In `src/tools/sandbox.ts`, in `runInSandbox`, this line is broken:

```typescript
const workdirMount = options.workdir
  ? `-v '${shellEscape(options.workdir)}:/workdir:ro -w /workdir`
  : '';
```

The opening single quote is never closed. The volume flag and the `-w` flag are
merged into one string that Docker cannot parse. Also the volume is mounted
read-only (`:ro`) which prevents writing inside the container.

Replace with two separate, correct flags:

```typescript
const workdirMount = options.workdir
  ? `-v '${shellEscape(options.workdir)}:/workdir' -w /workdir`
  : '';
```

Remove the `:ro` so the mounted directory is writable.

### Fix 2: Add CARINA_DIRECT_SHELL mode (in sandbox.ts)

Add a new exported function `runDirectShell` in `src/tools/sandbox.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec); // already exists

export async function runDirectShell(
  command: string,
  options: { timeout: number; workdir?: string },
): Promise<SandboxResult> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      timeout: options.timeout,
      maxBuffer: 10 * 1024 * 1024,
      cwd: options.workdir,
      shell: '/bin/bash',
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number; message?: string };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? e.message ?? String(err),
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}
```

### Fix 3: Use direct shell when CARINA_DIRECT_SHELL=true (in shell.ts)

In `src/tools/shell.ts`, import `runDirectShell` from `./sandbox.js`.

In the `execute` function, in the foreground (non-background, non-pty) branch,
replace the sandbox routing block:

```typescript
const sessionId = typeof params._sessionId === 'string' ? params._sessionId : 'default-session';
const useSessionSandbox = sessionSandboxEnabled() || params.sandbox_session === true;

const result = useSessionSandbox
  ? await execInSessionSandbox(...)
  : await runInSandbox(...);
```

With this logic that checks direct-shell mode first:

```typescript
const sessionId = typeof params._sessionId === 'string' ? params._sessionId : 'default-session';
const useSessionSandbox = sessionSandboxEnabled() || params.sandbox_session === true;
const useDirectShell = process.env.CARINA_DIRECT_SHELL === 'true';

const result = useDirectShell
  ? await runDirectShell(command, { timeout: timeoutMs, workdir })
  : useSessionSandbox
    ? await execInSessionSandbox(sessionId, command, undefined, timeoutMs)
    : await runInSandbox(command, SANDBOX_IMAGE, {
        timeout: timeoutMs,
        memoryMb: 128,
        networkDisabled: true,
        workdir,
      });
```

### Fix 4: Improve tool description

Replace the current description in `shellExecTool` with:

```
'Execute a shell command and return stdout, stderr, and exit code. Supports foreground (default), background (background=true), and PTY mode (pty=true, requires CARINA_PTY_ENABLED=true). Set CARINA_DIRECT_SHELL=true in .env to run commands directly on the host (required for npm, git, pip, and file writes). Without it, commands run in a restricted Docker sandbox (alpine:latest, no network, read-only fs). workdir sets the working directory. Use background=true for long-running servers or builds.'
```

### Fix 5: Add tests for the new direct-shell mode and the workdir fix

In `src/tools/shell.test.ts`, ADD these tests (do not remove existing ones):

**Test: direct shell mode is used when CARINA_DIRECT_SHELL=true**

```typescript
it('uses runDirectShell when CARINA_DIRECT_SHELL is true', async () => {
  process.env.CARINA_DIRECT_SHELL = 'true';
  const runDirectShell = vi.fn().mockResolvedValue({ stdout: 'hello', stderr: '', exitCode: 0 });
  vi.doMock('./sandbox.js', () => ({ runDirectShell, runInSandbox: vi.fn(), isDockerAvailable: vi.fn() }));
  vi.doMock('../infrastructure/sandbox-session.js', () => ({
    execInSessionSandbox: vi.fn(),
    sessionSandboxEnabled: vi.fn().mockReturnValue(false),
  }));
  const { shellExecTool } = await import('./shell.js');
  const result = await shellExecTool.execute({ command: 'echo hello' }) as { stdout: string };
  expect(runDirectShell).toHaveBeenCalledWith('echo hello', expect.objectContaining({ timeout: 30_000 }));
  expect(result.stdout).toBe('hello');
  delete process.env.CARINA_DIRECT_SHELL;
});
```

**Test: Docker workdir mount flag is correctly formed (no unclosed quote)**

```typescript
it('forms correct Docker -v flag with closing quote', async () => {
  const runInSandbox = vi.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 });
  vi.doMock('./sandbox.js', () => ({
    runInSandbox,
    checkDocker: vi.fn().mockResolvedValue(true),
    isDockerAvailable: vi.fn().mockReturnValue(true),
  }));
  // The actual fix is in sandbox.ts runInSandbox, tested by checking the produced dockerCmd.
  // Here we verify the shell tool passes workdir correctly to runInSandbox.
  const { shellExecTool } = await import('./shell.js');
  await shellExecTool.execute({ command: 'ls', workdir: '/tmp' });
  expect(runInSandbox).toHaveBeenCalledWith(
    'ls',
    'alpine:latest',
    expect.objectContaining({ workdir: '/tmp' }),
  );
});
```

**Test: direct shell returns exitCode on command failure**

```typescript
it('direct shell returns non-zero exitCode on failure', async () => {
  process.env.CARINA_DIRECT_SHELL = 'true';
  const runDirectShell = vi.fn().mockResolvedValue({ stdout: '', stderr: 'not found', exitCode: 127 });
  vi.doMock('./sandbox.js', () => ({ runDirectShell, runInSandbox: vi.fn(), isDockerAvailable: vi.fn() }));
  vi.doMock('../infrastructure/sandbox-session.js', () => ({
    execInSessionSandbox: vi.fn(),
    sessionSandboxEnabled: vi.fn().mockReturnValue(false),
  }));
  const { shellExecTool } = await import('./shell.js');
  const result = await shellExecTool.execute({ command: 'bogus-command' }) as { exitCode: number };
  expect(result.exitCode).toBe(127);
  delete process.env.CARINA_DIRECT_SHELL;
});
```

---

## What NOT to change

- Do not change `src/tools/process.ts` or `src/tools/process-registry.ts`.
- Do not change the `requiresConfirmation: true` or `dangerous: true` flags on `shellExecTool`.
- Do not remove the root-user guard (`process.getuid?.() === 0`).
- Do not remove the existing tests in `shell.test.ts`.
- Do not change the background process path or the PTY path.
- Do not add the `CARINA_DIRECT_SHELL` env var to the `.env` file on disk - just make
  the code read it. The operator adds it to their own `.env` when they want direct mode.

---

## General rules

- TypeScript only. No `any` unless unavoidable (document why).
- No em dashes, no emojis anywhere.
- Functions under 20 lines.
- Run `npx tsc --noEmit` after every file change. Fix all errors before moving on.
- Run `npx vitest run src/tools/shell.test.ts` after writing tests. All must pass.
- Do not touch files not listed in this prompt unless a type error forces it.

## Verification checklist

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/shell.test.ts` all pass (existing 6 + new 3 = 9 total)
- [ ] `npx vitest run src/tools/memory.test.ts src/tools/todo.test.ts src/tools/clarify.test.ts src/tools/session-search.test.ts` still pass (regression check)
- [ ] In `sandbox.ts`, the workdir Docker `-v` flag has a closing single quote and no `:ro`
- [ ] `runDirectShell` is exported from `sandbox.ts`
- [ ] `CARINA_DIRECT_SHELL=true` triggers the direct path in `shell.ts`
- [ ] Existing tests for root-check, dangerous flag, confirmation, timeout clamp,
      output truncation, and background processes still pass unchanged
