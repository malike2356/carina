# Gap 22 - Prompt 02: SSH & OpenShell Backends

**Gap:** 22 Sandbox & Runtime Isolation
**Prompt number:** 02 of 03
**Name:** SSH proxy backend + OpenShell lightweight isolation backend
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 01-sandbox-architecture.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Build the two alternative sandbox backends.

### 1. SSH Backend

For users who want sandboxing on a separate machine (VPS, dev server) without
Docker. All exec commands proxy over SSH.

```typescript
// security/sandbox/ssh-backend.ts
import { Client } from 'ssh2';

export class SSHSandboxBackend implements SandboxBackend {
  private connections: Map<string, Client> = new Map();

  constructor(private config: Required<SandboxConfig['ssh']>) {}

  async init(sessionId: string): Promise<void> {
    const conn = new Client();
    await new Promise<void>((resolve, reject) => {
      conn.on('ready', resolve);
      conn.on('error', reject);
      conn.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.user,
        privateKey: require('fs').readFileSync(this.config.keyPath),
        readyTimeout: 10000,
      });
    });
    this.connections.set(sessionId, conn);
  }

  async exec(
    sessionId: string,
    command: string,
    workDir = this.config.workDir,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const conn = this.connections.get(sessionId);
    if (!conn) throw new Error(`No SSH connection for session ${sessionId}`);

    const fullCommand = `cd ${shellEscape(workDir)} && ${command}`;

    return new Promise((resolve) => {
      conn.exec(fullCommand, (err, stream) => {
        if (err) return resolve({ stdout: '', stderr: err.message, exitCode: 1 });

        let stdout = '';
        let stderr = '';
        stream.on('data', (data: Buffer) => { stdout += data.toString(); });
        stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
        stream.on('close', (code: number) => {
          resolve({ stdout, stderr, exitCode: code || 0 });
        });
      });
    });
  }

  async teardown(sessionId: string): Promise<void> {
    const conn = this.connections.get(sessionId);
    if (conn) {
      conn.end();
      this.connections.delete(sessionId);
    }
  }
}
```

### 2. OpenShell Backend

Lightweight isolation without Docker. Uses:
- Separate Node.js `child_process` with restricted env
- Optional chroot via `CARINA_OPENSHELL_CHROOT`
- Path allowlisting for file operations

```typescript
// security/sandbox/openshell-backend.ts
import { spawn } from 'node:child_process';

export class OpenShellBackend implements SandboxBackend {
  private sessions: Map<string, { chroot?: string; allowedPaths: string[] }> = new Map();

  constructor(private config: SandboxConfig['openshell']) {}

  async init(sessionId: string): Promise<void> {
    this.sessions.set(sessionId, {
      chroot: this.config?.chroot,
      allowedPaths: this.config?.allowedPaths || ['/tmp', process.env.CARINA_WORKSPACE || '/tmp/carina-workspace'],
    });
  }

  async exec(
    sessionId: string,
    command: string,
    workDir?: string,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`No OpenShell session ${sessionId}`);

    // Validate workDir is within allowed paths
    if (workDir && !this.isPathAllowed(workDir, session.allowedPaths)) {
      return { stdout: '', stderr: `Path not allowed: ${workDir}`, exitCode: 1 };
    }

    return new Promise((resolve) => {
      const child = spawn('bash', ['-c', command], {
        cwd: workDir || process.cwd(),
        env: {
          ...process.env,
          HOME: '/tmp/openshell-home',
          PATH: '/usr/local/bin:/usr/bin:/bin',
          // Strip sensitive env vars
          CARINA_ADMIN_PASSWORD: undefined,
          OPENAI_API_KEY: undefined,
          ANTHROPIC_API_KEY: undefined,
        },
        timeout: 300000, // 5 min
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (d: Buffer) => { stdout += d.toString(); });
      child.stderr.on('data', (d: Buffer) => { stderr += d.toString(); });
      child.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code || 0 });
      });
      child.on('error', (err) => {
        resolve({ stdout, stderr: err.message, exitCode: 1 });
      });
    });
  }

  async teardown(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  private isPathAllowed(path: string, allowedPaths: string[]): boolean {
    return allowedPaths.some(allowed => path.startsWith(allowed));
  }
}
```

### 3. Backend Selection

Environment-based selection:

```typescript
// Default via config:
// CARINA_SANDBOX_MODE=off|docker|ssh|openshell

// Per-agent override in agent config:
// agents.list[].sandbox.mode = 'docker'
```

---

## Existing Carina code to integrate with

- `security/sandbox/` -- new directory
- `agents/tool-runner.ts` -- route through sandbox
- `config/schema.ts` -- `CARINA_SANDBOX_MODE`, per-agent overrides
- `docker/Dockerfile.sandbox` -- from prompt 01
