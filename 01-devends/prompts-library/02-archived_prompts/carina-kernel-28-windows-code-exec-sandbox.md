# Carina Kernel: Cross-platform code execution sandbox

## Goal

Make the `code-exec` tool work on Windows without requiring Docker or Linux containers.
Use a tiered approach: Docker Linux containers when available, `worker_threads` sandbox
when Docker is not available. Give a clear, user-friendly message about which tier is active.

## Context

Current behaviour: `code-exec` uses Docker to run user code in an isolated Linux container.
On Windows, Docker Desktop is required, which is a 500MB download, requires Hyper-V or
WSL2, and must run as a background service. Most Windows users will not have it.

Tiered sandbox design:

| Tier | When used | Isolation level | Works on |
|------|-----------|-----------------|----------|
| Docker sandbox | Docker daemon available | Strong (container, resource limits) | Linux, macOS, Windows with Docker Desktop |
| worker_threads sandbox | No Docker | Medium (separate V8 heap, no native module access) | All platforms |
| Blocked | Neither available and `CARINA_UNSAFE_CODE_EXEC=false` | None | - |

The `worker_threads` sandbox is not as strong as Docker: a malicious script can still
access the filesystem and make network requests unless further restricted. Document this
clearly. For most legitimate use cases (running math, parsing data, testing algorithms),
`worker_threads` is sufficient.

## Dependencies

Prompts 25-26 should be complete first.

## Files to modify

```
src/tools/code-exec.ts              (main tool handler)
src/sandbox/docker-sandbox.ts       (existing Docker implementation)
src/sandbox/worker-sandbox.ts       (new: worker_threads fallback)
src/sandbox/sandbox-factory.ts      (new: picks the right sandbox)
```

## Step-by-step

### 1. Docker availability check

`src/sandbox/sandbox-factory.ts`:

```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let dockerAvailable: boolean | null = null;

export async function isDockerAvailable(): Promise<boolean> {
  if (dockerAvailable !== null) return dockerAvailable;

  try {
    await execAsync('docker info', { timeout: 5000 });
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }

  return dockerAvailable;
}

export type SandboxResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  sandboxTier: 'docker' | 'worker_threads';
  durationMs: number;
};

export async function runInSandbox(
  code: string,
  language: 'javascript' | 'python',
  timeoutMs: number,
): Promise<SandboxResult> {
  if (language !== 'javascript') {
    // Python requires a runtime; Docker is needed for non-JS languages
    const dockerOk = await isDockerAvailable();
    if (!dockerOk) {
      return {
        stdout: '',
        stderr: `Python code execution requires Docker. Install Docker Desktop and ensure it is running, or use JavaScript which runs natively.`,
        exitCode: 1,
        sandboxTier: 'worker_threads',
        durationMs: 0,
      };
    }
  }

  const dockerOk = await isDockerAvailable();

  if (dockerOk) {
    const { runInDocker } = await import('./docker-sandbox.js');
    const start = Date.now();
    const result = await runInDocker(code, language, timeoutMs);
    return { ...result, sandboxTier: 'docker', durationMs: Date.now() - start };
  }

  // Fallback: worker_threads for JavaScript only
  const { runInWorker } = await import('./worker-sandbox.js');
  const start = Date.now();
  const result = await runInWorker(code, timeoutMs);
  return { ...result, sandboxTier: 'worker_threads', durationMs: Date.now() - start };
}
```

### 2. Worker threads sandbox

`src/sandbox/worker-sandbox.ts`:

```typescript
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';

const WORKER_SCRIPT = `
const { parentPort, workerData } = require('worker_threads');
const { code } = workerData;

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

let stdout = '';
let stderr = '';

console.log = (...args) => { stdout += args.join(' ') + '\\n'; };
console.error = (...args) => { stderr += args.join(' ') + '\\n'; };
console.warn = (...args) => { stderr += '[warn] ' + args.join(' ') + '\\n'; };

try {
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  const fn = new AsyncFunction(code);
  fn().then(() => {
    parentPort.postMessage({ stdout, stderr, exitCode: 0 });
  }).catch((err) => {
    parentPort.postMessage({ stdout, stderr: stderr + err.message + '\\n' + err.stack, exitCode: 1 });
  });
} catch (err) {
  parentPort.postMessage({ stdout, stderr: err.message + '\\n' + (err.stack ?? ''), exitCode: 1 });
}
`;

export type WorkerResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export async function runInWorker(
  code: string,
  timeoutMs: number,
): Promise<WorkerResult> {
  return new Promise((resolve) => {
    // Write worker script to temp file (required for Worker constructor in some Node configs)
    const workerFile = join(tmpdir(), 'carina', `worker-${Date.now()}.cjs`);

    try {
      writeFileSync(workerFile, WORKER_SCRIPT);
    } catch {
      resolve({ stdout: '', stderr: 'Failed to create worker script file', exitCode: 1 });
      return;
    }

    const worker = new Worker(workerFile, {
      workerData: { code },
      // Restrict resource access; worker_threads cannot fully sandbox networking
      // but we can limit env exposure
      env: {
        NODE_ENV: 'sandbox',
      },
    });

    const timer = setTimeout(() => {
      void worker.terminate().catch(() => undefined);
      resolve({
        stdout: '',
        stderr: `Code execution timed out after ${timeoutMs}ms`,
        exitCode: 124,
      });
    }, timeoutMs);

    worker.on('message', (result: WorkerResult) => {
      clearTimeout(timer);
      try { unlinkSync(workerFile); } catch { /* ignore cleanup failure */ }
      resolve(result);
    });

    worker.on('error', (err) => {
      clearTimeout(timer);
      try { unlinkSync(workerFile); } catch { /* ignore */ }
      resolve({ stdout: '', stderr: err.message, exitCode: 1 });
    });

    worker.on('exit', (code) => {
      clearTimeout(timer);
      try { unlinkSync(workerFile); } catch { /* ignore */ }
      if (code !== 0) {
        resolve({ stdout: '', stderr: `Worker exited with code ${code}`, exitCode: code });
      }
    });
  });
}
```

### 3. Update code-exec tool handler

In `src/tools/code-exec.ts`, replace the direct Docker call with the factory:

```typescript
import { runInSandbox } from '../sandbox/sandbox-factory.js';

// In the tool handler:
handler: async ({ code, language = 'javascript', timeout = 10000 }, _ctx) => {
  const result = await runInSandbox(code, language, timeout);

  const warning = result.sandboxTier === 'worker_threads'
    ? '\n[Note: Running in worker_threads sandbox. Install Docker for stronger isolation.]'
    : '';

  return {
    stdout: result.stdout,
    stderr: result.stderr + warning,
    exitCode: result.exitCode,
    language,
    sandboxTier: result.sandboxTier,
    durationMs: result.durationMs,
  };
},
```

### 4. Update tool description

```typescript
{
  name: 'code-exec',
  description: `Execute JavaScript or Python code in a sandboxed environment.
JavaScript: runs in a worker_threads sandbox on all platforms (no Docker required).
Python: requires Docker to be installed and running.
Docker provides stronger isolation; worker_threads sandbox is available when Docker is not.`,
}
```

### 5. Environment variable override

Allow operators to disable the worker_threads fallback if they require Docker isolation:

```typescript
// In sandbox-factory.ts, add before fallback:
if (!dockerOk && process.env.CARINA_REQUIRE_DOCKER_SANDBOX === 'true') {
  return {
    stdout: '',
    stderr: 'Docker is required for code execution (CARINA_REQUIRE_DOCKER_SANDBOX=true) but Docker is not available.',
    exitCode: 1,
    sandboxTier: 'worker_threads',
    durationMs: 0,
  };
}
```

## Test

`src/sandbox/worker-sandbox.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { runInWorker } from './worker-sandbox.js';

describe('runInWorker', () => {
  it('runs simple arithmetic and returns stdout', async () => {
    const result = await runInWorker('console.log(2 + 2)', 5000);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('4');
  });

  it('captures console.error in stderr', async () => {
    const result = await runInWorker('console.error("oops")', 5000);
    expect(result.stderr).toContain('oops');
  });

  it('catches thrown errors and returns exitCode 1', async () => {
    const result = await runInWorker('throw new Error("intentional")', 5000);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('intentional');
  });

  it('enforces timeout', async () => {
    const result = await runInWorker('await new Promise(r => setTimeout(r, 10000))', 500);
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain('timed out');
  }, 2000);

  it('handles async code', async () => {
    const result = await runInWorker(
      'const r = await fetch("data:text/plain,hello"); console.log(await r.text())',
      5000,
    );
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe('hello');
  });
});
```

`src/sandbox/sandbox-factory.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('sandbox tier selection', () => {
  it('uses worker sandbox when Docker is unavailable', async () => {
    vi.mock('./docker-sandbox.js', () => ({ runInDocker: vi.fn() }));
    vi.mock('child_process', () => ({
      exec: (_cmd: string, _opts: unknown, cb: (err: Error) => void) => cb(new Error('not found')),
    }));

    const { runInSandbox } = await import('./sandbox-factory.js');
    const result = await runInSandbox('console.log(1)', 'javascript', 5000);
    expect(result.sandboxTier).toBe('worker_threads');
  });
});
```

## Expected behavior

On Windows without Docker:
```
User: Run this code: console.log("hello from Windows")

Carina: hello from Windows
[Note: Running in worker_threads sandbox. Install Docker for stronger isolation.]
```

On any platform with Docker running:
```
User: Run this Python: print("hello")

Carina: hello
```

## Pitfalls

- The worker_threads sandbox uses `new AsyncFunction(code)` which is equivalent to
  `eval()`. It cannot sandbox network or filesystem access. Document this to users
  and do not use `worker_threads` mode for untrusted user input in multi-tenant environments
- `Worker` constructor requires a file path or a `data:` URL in older Node.js versions.
  The temp file approach in the implementation above is the most compatible
- Python via `worker_threads` is not feasible because Python is a separate runtime.
  The fallback only covers JavaScript. For Python on Windows without Docker, the
  only option is to install Python and spawn it directly (no container isolation)
- Docker availability is cached after the first check (`dockerAvailable` variable).
  If the user starts Docker after Carina starts, the cache will say "unavailable"
  until Carina restarts. Add a `POST /api/ops/refresh-docker-check` admin endpoint
  to reset `dockerAvailable = null` if this matters for your use case
