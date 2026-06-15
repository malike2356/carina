# Removing Windows Friction from Carina

**Date:** 14 June 2026
**Problem:** Carina requires WSL on Windows. ~70% of desktop users worldwide run Windows. That's a massive adoption barrier for the "Linux kernel for AI agents" vision.

---

## The Friction Points (What Breaks on Windows)

| Feature | Unix Behavior | Windows Behavior | Breakage |
|---------|--------------|-----------------|----------|
| `shell-exec` | bash/sh, Unix commands, pipes, /tmp | cmd.exe or PowerShell, different syntax | Tool unusable without WSL |
| `process` (bg, PTY) | fork, SIGTERM, /proc, PTY via pty.open | No fork, no /proc, PTY needs winpty | Background/PTY modes fail |
| `code-exec` sandbox | Docker Linux containers | Docker Desktop heavy, different networking | Sandbox unavailable or broken |
| `delegate-task` | spawn child via fork | No fork; spawns new process differently | Subagent isolation different |
| File paths | /tmp, /home, Unix separators | C:\Users\, Temp, backslashes | Path construction fails |
| Cron/scheduling | cron daemon or node-cron | Windows Task Scheduler or node-cron | Works with node-cron (already OK) |
| PTY interactive tools | bash PTY for Claude Code, Codex | No native PTY | Interactive CLI tools fail |

---

## The Fix: Platform-Aware Tool Layer

The solution is NOT to make Windows users install WSL. It's to make every tool check what platform it's on and take the right path. This is how VS Code, npm, Node.js itself, and every serious cross-platform tool works.

### 1. Shell Execution -- Platform Detection

**Current:** `shell-exec` assumes bash.

**Fix:**

```typescript
// src/tools/shell-exec.ts
function getShell(): string {
  if (process.platform === 'win32') {
    // Prefer PowerShell, fall back to cmd
    try { 
      execSync('powershell -Command "exit 0"');
      return 'powershell';
    } catch {
      return 'cmd';
    }
  }
  return process.env.SHELL || '/bin/bash';
}

function getShellArgs(command: string, shell: string): string[] {
  if (shell === 'powershell') return ['-Command', command];
  if (shell === 'cmd') return ['/c', command];
  return ['-c', command];
}

function normalizePath(p: string): string {
  return process.platform === 'win32' ? p.replace(/\//g, '\\') : p;
}

function getTempDir(): string {
  return os.tmpdir(); // Works on both: /tmp on Unix, C:\Users\...\AppData\Local\Temp on Windows
}
```

**Impact:** Windows users can run shell commands. Common commands (`dir` vs `ls`, `type` vs `cat`) need documentation, not code changes -- the agent learns the platform it's on.

### 2. File Operations -- Path Normalization

**Current:** Some tools use hardcoded `/tmp` or Unix path separators.

**Fix:**

```typescript
// Never: const tmp = '/tmp/something'
// Always:
import os from 'os';
import path from 'path';
const tmp = path.join(os.tmpdir(), 'carina', 'something');

// Never: const p = base + '/' + filename
// Always:
const p = path.join(base, filename);
```

**Audit needed:** Search codebase for hardcoded `/tmp`, `/home`, `/var`, and string-concatenated paths. Replace with `os.tmpdir()`, `os.homedir()`, and `path.join()`.

### 3. Process Management -- Cross-Platform Primitives

**Current:** `process` tool uses Unix-specific patterns (SIGTERM, /proc).

**Fix:**

```typescript
// src/tools/process.ts
function killProcess(pid: number, platform: string): void {
  if (platform === 'win32') {
    // Windows: taskkill
    execSync(`taskkill /PID ${pid} /F`);
  } else {
    // Unix: SIGTERM with SIGKILL fallback
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      process.kill(pid, 'SIGKILL');
    }
  }
}

function listProcesses(platform: string): ProcessInfo[] {
  if (platform === 'win32') {
    // tasklist /FO CSV
    return parseWindowsTasklist();
  }
  // ps aux or /proc
  return parseUnixPs();
}
```

**Node.js `child_process` already works cross-platform.** The issue is the tool wrapping, not the Node primitives. Fix the tool, not the runtime.

### 4. PTY Mode -- Use node-pty (Cross-Platform)

**Current:** PTY mode uses native Unix PTY, fails on Windows.

**Fix:** Use `node-pty` package. It has built-in Windows support (via winpty).

```typescript
// src/tools/terminal.ts
import * as pty from 'node-pty';

function spawnPty(command: string, args: string[], workdir: string): pty.IPty {
  const shell = process.platform === 'win32' 
    ? 'powershell.exe' 
    : process.env.SHELL || '/bin/bash';
  
  return pty.spawn(shell, [], {
    name: 'xterm-color',
    cwd: workdir,
    env: process.env,
  });
}
```

`node-pty` handles the Windows complexity internally. One line of code change.

### 5. Background Processes -- Use Node child_process (Cross-Platform)

**Current:** Background processes rely on Unix fork and nohup.

**Fix:** Node's `child_process.spawn` with `detached: true` works on Windows. No fork needed.

```typescript
function spawnBackground(command: string, args: string[], workdir: string): ChildProcess {
  const child = spawn(command, args, {
    cwd: workdir,
    detached: true,
    stdio: 'pipe',
    shell: process.platform === 'win32', // Windows needs shell: true
  });
  child.unref(); // Let parent exit independently
  return child;
}
```

### 6. Docker Sandbox -- Graceful Fallback

**Current:** `code-exec` requires Docker. If Docker is unavailable, it fails hard.

**Fix:** Two-tier execution model:

```typescript
// src/tools/code-exec.ts
async function executeCode(code: string, language: string): Promise<Result> {
  // Tier 1: Docker sandbox (preferred, if available)
  if (await dockerAvailable()) {
    return executeInDockerSandbox(code, language);
  }
  
  // Tier 2: Isolated worker_thread (Windows, no-Docker systems)
  if (language === 'javascript' || language === 'typescript') {
    return executeInWorkerThread(code);
  }
  
  // Tier 3: Clear error message
  return {
    error: 'Docker not available. Code execution requires Docker. Install Docker Desktop or use WSL.',
    hint: 'For Windows: Install Docker Desktop from https://docker.com'
  };
}
```

For non-JS languages on Windows without Docker: the tool returns a clear, helpful error. It doesn't crash. The agent can tell the user what's needed.

### 7. Delegate-Task Subagents -- Worker Threads on Windows

**Current:** Subagents spawn via Unix process model.

**Fix:** Use `worker_threads` as primary, `child_process` as fallback:

```typescript
function spawnSubagent(context: SubagentContext): SubagentHandle {
  if (process.platform === 'win32' || preferWorkerThreads()) {
    // Use Node worker_threads (works on all platforms, lighter)
    return spawnViaWorkerThread(context);
  }
  // Unix: use child_process fork (better process isolation)
  return spawnViaChildProcess(context);
}
```

---

## Implementation Plan

### Phase 1: Path Normalization (1 day)
Search and replace all hardcoded paths. `os.tmpdir()`, `os.homedir()`, `path.join()`. This fixes most silent Windows bugs.

### Phase 2: Shell-Exec Platform Detection (2 days)
Add platform detection to `shell-exec`. PowerShell on Windows, bash on Unix. Test common commands.

### Phase 3: Process + PTY Cross-Platform (2 days)
Add `node-pty` dependency. Rewrite PTY spawning. Fix process listing/killing for Windows.

### Phase 4: Code-Exec Fallback (1 day)
Add Docker availability check. Implement worker_thread fallback. Clear error messages.

### Phase 5: Delegate-Task Worker Threads (1 day)
Implement worker_thread subagent spawning. Make it the default.

### Phase 6: Windows CI Testing (1 day)
Add a Windows runner to CI. Test the core toolset on Windows. Catch regressions.

**Total: ~8 days of focused work.**

---

## What Does NOT Need Changing

| Component | Reason |
|-----------|--------|
| Memory system (Postgres/SQLite) | Already cross-platform |
| Browser automation (Playwright) | Playwright is cross-platform, works on Windows natively |
| Web search, HTTP, email | Pure Node.js, works everywhere |
| File read/write/patch/search | `fs` and `path` modules are cross-platform; just fix hardcoded paths |
| TTS, STT, vision, image gen | API calls, no platform dependency |
| MCP client/server | Protocol-level, no platform dependency |
| Cron/scheduling | node-cron works on Windows |
| Send message, channels | Pure JS, works everywhere |
| Skills, RAG, memory | Database-backed, no platform dependency |
| npm install | Already works on Windows (npm is cross-platform) |

---

## The Honest Assessment

**This is a week of work, not a rewrite.** Node.js is already cross-platform. The issue is that Carina was built on Linux and never tested on Windows. Most tools work fine. A small number have Unix assumptions baked in.

The friction is fixable. VS Code, npm, and thousands of Node.js tools run on Windows without WSL. Carina can too.

**What changes for the user:**

Before:
```
> carina shell-exec "ls /tmp"
Error: bash not found
```

After:
```
> carina shell-exec "dir C:\Users\kwame\AppData\Local\Temp"
 Volume in drive C is Windows
 Directory of C:\Users\kwame\AppData\Local\Temp

06/14/2026  10:23 AM    <DIR>          carina-sandbox
```

The agent learns it's on Windows. It uses `dir` instead of `ls`. It uses `C:\Users\...` instead of `/home/...`. The user never needs to know the difference.

---

## Windows Installer (Bonus)

While we're at it, ship a Windows installer:

```
carina-setup.exe
  - Checks for Node.js 22+ (installs if missing via winget)
  - Installs carina-agent globally
  - Adds to PATH
  - Creates Start Menu shortcut for carina chat
  - First-run wizard detects Windows and configures accordingly
```

Uses `pkg` or `nexe` to create a standalone .exe that bundles Node.js. One download. No terminal needed for setup. This is how Docker Desktop, VS Code, and every serious cross-platform dev tool handles Windows.
