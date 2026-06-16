# Carina Kernel: Windows-compatible shell-exec tool

## Goal

Make the `shell-exec` tool work natively on Windows 10 without WSL. On Windows, use
PowerShell Core (`pwsh.exe`) or fallback to `powershell.exe`. On Linux/macOS, continue
using `bash`. No behaviour change for existing users; Windows users get a working shell.

## Context

Currently `shell-exec` spawns `/bin/bash -c <command>`. On Windows there is no
`/bin/bash` (unless WSL is installed). This causes a hard failure for any Windows user
who tries to use any shell tool.

The fix is platform detection at spawn time. PowerShell on Windows is the correct
equivalent: it is installed on all Windows 10+ machines, supports pipelines, has most
common utilities (`ls`, `cat`, `grep` are aliases in PowerShell), and understands paths.

The tool must also handle:
- Line ending normalisation (Windows outputs CRLF; normalise to LF before returning)
- Exit codes (same semantics on both platforms)
- Timeout (same logic; just the spawn command differs)
- The `dangerous: true` classification in `TOOL_RISK_REGISTRY` stays unchanged

## Dependencies

None. This is a standalone tool fix.

## Files to modify

```
src/tools/shell-exec.ts               (or wherever shell-exec is defined)
src/tools/tool-risk-registry.ts       (add windows note to sideEffects if not present)
```

## Step-by-step

### 1. Find the current implementation

```bash
find src/tools -name "shell*" -o -name "*exec*" | grep -v test | grep -v node_modules
```

Read the file. Identify:
- Where `child_process.exec` or `spawn` is called
- What shell is hardcoded (`/bin/bash`, `bash`, `sh`)
- How stdout/stderr are collected
- How timeout is implemented

### 2. Platform detection helper

Create `src/tools/platform.ts` (or add to an existing helpers file):

```typescript
import { platform } from 'os';

export type ShellDescriptor = {
  command: string;
  args: (userCommand: string) => string[];
  lineSeparator: string;
};

export function getPlatformShell(): ShellDescriptor {
  if (platform() === 'win32') {
    // Prefer PowerShell Core (pwsh.exe); fall back to Windows PowerShell
    return {
      command: 'pwsh.exe',
      args: (cmd) => ['-NoProfile', '-NonInteractive', '-Command', cmd],
      lineSeparator: '\r\n',
    };
  }
  return {
    command: '/bin/bash',
    args: (cmd) => ['-c', cmd],
    lineSeparator: '\n',
  };
}

export function normaliseLf(text: string): string {
  return text.replace(/\r\n/g, '\n');
}
```

PowerShell flags:
- `-NoProfile`: do not load user profile scripts (faster, reproducible)
- `-NonInteractive`: no prompts; errors go to stderr
- `-Command`: execute the following as a command string (equivalent to `bash -c`)

### 3. Update shell-exec handler

In `shell-exec.ts`, replace the hardcoded shell spawn with:

```typescript
import { spawn } from 'child_process';
import { getPlatformShell, normaliseLf } from './platform.js';

async function executeShellCommand(
  command: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const shell = getPlatformShell();

  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const child = spawn(shell.command, shell.args(command), {
      stdio: ['ignore', 'pipe', 'pipe'],
      // On Windows, do not inherit the parent's console window
      windowsHide: true,
    });

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8'); });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);

    child.on('error', (err) => {
      clearTimeout(timer);
      // On Windows, if pwsh.exe not found, try fallback
      if ((err as NodeJS.ErrnoException).code === 'ENOENT' && shell.command === 'pwsh.exe') {
        // Retry with legacy Windows PowerShell
        executeFallbackShell(command, timeoutMs).then(resolve).catch(reject);
        return;
      }
      reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({
        stdout: normaliseLf(stdout),
        stderr: normaliseLf(stderr),
        exitCode: timedOut ? -1 : (code ?? -1),
      });
    });
  });
}

async function executeFallbackShell(
  command: string,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';

    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
    child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });

    const timer = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout: normaliseLf(stdout), stderr: normaliseLf(stderr), exitCode: code ?? -1 });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: 'No shell available on this system', exitCode: 1 });
    });
  });
}
```

### 4. Update tool description to mention PowerShell

In the tool definition object, update the `description` field:

```typescript
{
  name: 'shell-exec',
  description: 'Execute a shell command. Uses bash on Linux/macOS and PowerShell on Windows. Commands should use portable syntax where possible. On Windows, PowerShell cmdlets are available.',
  // ...
}
```

Add a `platform` field to the tool output so callers know which shell ran:

```typescript
return {
  stdout: result.stdout,
  stderr: result.stderr,
  exitCode: result.exitCode,
  shell: platform() === 'win32' ? 'powershell' : 'bash',
};
```

### 5. Add a platform note to the tool risk registry

In `tool-risk-registry.ts`, update the `shell-exec` entry's `sideEffects`:

```typescript
'shell-exec': {
  riskClass: 'dangerous',
  sideEffects: [
    'executes arbitrary shell commands',
    'uses bash on Linux/macOS, PowerShell on Windows',
    'can modify filesystem, start processes, open network connections',
  ],
  requiresDangerousFlag: true,
},
```

## Test

Add `src/tools/shell-exec.windows.test.ts` (skipped on non-Windows CI, run on Windows runner):

```typescript
import { describe, it, expect } from 'vitest';
import { getPlatformShell, normaliseLf } from './platform.js';

describe('getPlatformShell', () => {
  it('returns a shell descriptor with a string command', () => {
    const shell = getPlatformShell();
    expect(typeof shell.command).toBe('string');
    expect(shell.command.length).toBeGreaterThan(0);
  });

  it('returns args as an array for a sample command', () => {
    const shell = getPlatformShell();
    const args = shell.args('echo hello');
    expect(Array.isArray(args)).toBe(true);
    expect(args.at(-1)).toContain('echo hello');
  });
});

describe('normaliseLf', () => {
  it('replaces CRLF with LF', () => {
    expect(normaliseLf('hello\r\nworld\r\n')).toBe('hello\nworld\n');
  });

  it('leaves LF-only input unchanged', () => {
    expect(normaliseLf('hello\nworld\n')).toBe('hello\nworld\n');
  });
});

// Integration test - only runs when shell is available
describe.runIf(process.env.RUN_SHELL_INTEGRATION === 'true')('shell-exec integration', () => {
  it('executes a simple command', async () => {
    const { executeShellCommand } = await import('./shell-exec.js');
    const result = await executeShellCommand('echo hello', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });
});
```

## Expected behavior

On Windows:
```
> carina chat
> shell-exec: echo hello
hello
(shell: powershell)
```

On Linux/macOS:
```
> carina chat
> shell-exec: echo hello
hello
(shell: bash)
```

## Pitfalls

- PowerShell uses different quoting than bash. Single quotes in PowerShell are literal
  strings; double quotes allow variable expansion. Carina should not rewrite user commands;
  just pass them through and let the user write PowerShell-compatible commands on Windows
- `SIGTERM` on Windows via `child.kill('SIGTERM')` works in Node.js for processes spawned
  by the same process; it calls `TerminateProcess()` underneath, which is an immediate kill
  (not graceful). This matches the timeout behaviour expected
- PowerShell has execution policy restrictions on some Windows machines. The `-NonInteractive`
  and `-Command` flags bypass this for inline commands; script file execution would need
  `-ExecutionPolicy Bypass`
- The fallback from `pwsh.exe` to `powershell.exe` is important: Windows 10 ships with
  `powershell.exe` (v5) but not `pwsh.exe` (PowerShell Core v7). Both work for basic
  commands but `pwsh.exe` is preferred for better Unicode and cross-platform compatibility
