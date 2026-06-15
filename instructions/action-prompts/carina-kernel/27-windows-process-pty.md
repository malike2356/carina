# Carina Kernel: Cross-platform process management and PTY

## Goal

Make the `process` tool and any PTY-based terminal interaction work on Windows using
`node-pty` (which includes Windows ConPTY support) and cross-platform `child_process.spawn`
flags. Replace Unix-specific SIGTERM/SIGKILL/`/proc` patterns with Node.js equivalents
that work on all platforms.

## Context

Current broken patterns on Windows:
- Spawning processes with `nohup ... &` (Unix shell background syntax)
- Using `kill -9 <pid>` to terminate processes (Unix kill command)
- Reading `/proc/<pid>/status` to check if a process is alive
- Using `node-pty` with Unix-only PTY configuration

`node-pty` version 1.x includes Windows ConPTY support (Windows 10 build 18309+).
It compiles to a native `.node` addon and works the same API surface on all platforms.
The process management fixes are pure Node.js `child_process` changes.

## Dependencies

Prompt 25 (shell-exec) and prompt 26 (file paths) should be complete first, but this
prompt can be implemented in any order.

## Package changes

```bash
cd core.carinaai.uk

# node-pty for cross-platform PTY (if not already installed)
pnpm add node-pty

# node-pty requires native build; ensure it compiles on Windows
# The package includes prebuilt binaries for most Node versions; run:
pnpm rebuild node-pty

# Also needed for Windows ConPTY on older Windows 10 versions
# No additional package needed; node-pty bundles ConPTY
```

## Files to modify

```
src/tools/process.ts          (or wherever background process/PTY tool is)
src/infrastructure/pty.ts     (if PTY is extracted into its own module)
```

## Step-by-step

### 1. Cross-platform process spawn (background)

Replace `nohup ... &` pattern with Node.js detached spawn:

Before (Unix only):
```typescript
import { exec } from 'child_process';

function spawnBackground(command: string): number {
  const child = exec(`nohup ${command} > /tmp/carina-bg.log 2>&1 &`);
  return child.pid!;
}
```

After (cross-platform):
```typescript
import { spawn } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { createWriteStream } from 'fs';

function spawnBackground(command: string, sessionId: string): number {
  const logFile = join(tmpdir(), 'carina', `bg-${sessionId}.log`);
  const logStream = createWriteStream(logFile, { flags: 'a' });

  const [cmd, ...args] = command.split(' ');
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    // Windows: hide the console window that would otherwise pop up
    windowsHide: true,
  });

  // Unref allows the parent process to exit without waiting for the child
  child.unref();

  return child.pid ?? -1;
}
```

`detached: true` + `child.unref()` is the cross-platform equivalent of `nohup ... &`.
It works identically on Windows, Linux, and macOS.

### 2. Cross-platform process kill

Replace Unix `kill` command with Node.js signal:

Before (Unix only):
```typescript
import { exec } from 'child_process';

function killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): void {
  exec(`kill -${signal === 'SIGKILL' ? '9' : '15'} ${pid}`);
}
```

After (cross-platform):
```typescript
function killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false; // Process does not exist
    throw err;
  }
}
```

`process.kill(pid, 'SIGTERM')` calls `TerminateProcess()` on Windows, which is an
immediate kill (Windows has no graceful SIGTERM concept). This is acceptable; document
it in the tool description.

### 3. Cross-platform process alive check

Replace `/proc/<pid>/status` read with signal 0:

Before (Linux only):
```typescript
import { existsSync } from 'fs';

function isProcessAlive(pid: number): boolean {
  return existsSync(`/proc/${pid}/status`);
}
```

After (cross-platform):
```typescript
function isProcessAlive(pid: number): boolean {
  try {
    // Signal 0 does not send any signal; it only checks if the process exists
    // and if the caller has permission to signal it.
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ESRCH') return false; // No such process
    if (code === 'EPERM') return true; // Process exists but we cannot signal it
    return false;
  }
}
```

### 4. PTY implementation using node-pty

If Carina implements an interactive terminal (PTY) for the agent:

```typescript
import * as pty from 'node-pty';
import { platform } from 'os';

export function createPty(options: {
  cols: number;
  rows: number;
  cwd: string;
  env?: Record<string, string>;
}): pty.IPty {
  const shell = platform() === 'win32'
    ? (process.env.ComSpec ?? 'powershell.exe')
    : (process.env.SHELL ?? '/bin/bash');

  const shellArgs = platform() === 'win32'
    ? []  // PowerShell/cmd start with no args in interactive mode
    : [];

  return pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: { ...process.env, ...options.env } as Record<string, string>,
  });
}
```

`node-pty` on Windows uses ConPTY (Windows 10 1809+) which provides a real terminal
multiplexer. The API is identical to Unix PTY from the Node.js perspective.

### 5. Process info without /proc

If the `process` tool returns system process information:

```typescript
import { cpus, freemem, totalmem, platform, loadavg } from 'os';

export function getSystemInfo() {
  return {
    platform: platform(),
    cpuCount: cpus().length,
    cpuModel: cpus()[0]?.model ?? 'unknown',
    totalMemoryMB: Math.round(totalmem() / 1024 / 1024),
    freeMemoryMB: Math.round(freemem() / 1024 / 1024),
    // loadavg() returns [0, 0, 0] on Windows (not supported)
    loadAvg: platform() !== 'win32' ? loadavg() : null,
  };
}
```

### 6. Update the process tool description

In the tool definition, add a Windows note:

```typescript
{
  name: 'run-background-process',
  description: 'Spawn a long-running process detached from the agent. ' +
    'On Windows, SIGTERM is an immediate kill (no graceful shutdown). ' +
    'On Linux/macOS, SIGTERM allows the process to clean up.',
}
```

## Test

`src/tools/process.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { isProcessAlive, killProcess } from './process.js';

describe('isProcessAlive', () => {
  it('returns true for the current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true);
  });

  it('returns false for a non-existent PID', () => {
    // PID 999999999 is unlikely to exist
    expect(isProcessAlive(999999999)).toBe(false);
  });
});

describe('killProcess', () => {
  it('returns false when killing a non-existent PID', () => {
    expect(killProcess(999999999)).toBe(false);
  });
});

describe.runIf(process.env.RUN_PTY_INTEGRATION === 'true')('PTY integration', () => {
  it('creates a PTY shell that responds to echo', async () => {
    const { createPty } = await import('../infrastructure/pty.js');
    const term = createPty({ cols: 80, rows: 24, cwd: process.cwd() });

    const output: string[] = [];
    term.onData((data) => output.push(data));

    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    term.write('echo carina-test\r');
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    term.kill();
    expect(output.join('')).toContain('carina-test');
  });
});
```

## Expected behavior

On Windows:
```
> carina background: python server.py
Process started with PID 1234 (background)
Log: C:\Users\user\AppData\Local\Temp\carina\bg-session.log
```

On Linux:
```
> carina background: python3 server.py
Process started with PID 5678 (background)
Log: /tmp/carina/bg-session.log
```

Both behave identically from the user's perspective.

## Pitfalls

- `node-pty` requires a native build and must be rebuilt for each Node.js version.
  Add `"postinstall": "pnpm rebuild node-pty"` to `package.json` scripts to automate this
  during `npm install -g carina-agent`
- ConPTY requires Windows 10 build 18309 or later. On older Windows 10 versions
  (pre-October 2018 update), `node-pty` falls back to winpty which is less compatible.
  Check `os.release()` and warn if below 18309
- `detached: true` on Windows requires that the spawned program is not a batch file (`.bat`).
  Batch files must be spawned through `cmd.exe /c`. For PowerShell scripts (`.ps1`),
  spawn `pwsh.exe -File script.ps1` with `detached: true`
- `process.kill(pid, 0)` on Windows requires the calling process to have read access to
  the target process. For processes owned by another user (e.g., SYSTEM), `EPERM` is thrown.
  The handler correctly returns `true` in this case (process exists, just not yours)
