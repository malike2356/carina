# Gap 22 - Prompt 01: Sandbox Architecture & Docker Backend

**Gap:** 22 Sandbox & Runtime Isolation
**Prompt number:** 01 of 03
**Name:** Sandbox interface, backend selection, Docker backend
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `security/rasp/engine.ts` -- existing RASP security
2. `security/kill-switch-listener.ts` -- sandbox_policy control
3. `agents/tool-runner.ts` -- where tools are executed
4. OpenClaw `src/sandbox/` (reference)

---

## Goal

### Step 1: Sandbox Interface

Create `security/sandbox/sandbox-interface.ts`:

```typescript
export type SandboxMode = 'off' | 'docker' | 'ssh' | 'openshell';
export type SandboxScope = 'session' | 'agent' | 'shared';

export interface SandboxConfig {
  mode: SandboxMode;
  scope: SandboxScope;
  workspaceAccess: 'readonly' | 'readwrite' | 'none';
  docker?: {
    image: string; // default: 'carina-sandbox:latest'
    networkMode: 'none' | 'bridge' | 'host';
    memoryLimitMb: number; // default: 512
    cpuLimit: number; // default: 1.0
    timeoutSeconds: number; // default: 300
    mountWorkspace: boolean;
    privilegedPorts: boolean; // false by default
  };
  ssh?: {
    host: string;
    port: number;
    user: string;
    keyPath: string;
    workDir: string;
  };
  openshell?: {
    chroot?: string;
    allowedPaths: string[];
    networkAccess: boolean;
  };
}

export interface SandboxBackend {
  /** Execute a command inside the sandbox. */
  exec(
    sessionId: string,
    command: string,
    workDir?: string,
    env?: Record<string, string>,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }>;

  /** Read a file from inside the sandbox. */
  readFile(sessionId: string, path: string): Promise<string>;

  /** Write a file inside the sandbox. */
  writeFile(sessionId: string, path: string, content: string): Promise<void>;

  /** Initialize sandbox for a session. */
  init(sessionId: string, config: SandboxConfig): Promise<void>;

  /** Teardown sandbox after session ends. */
  teardown(sessionId: string): Promise<void>;

  /** Health check. */
  health(): Promise<boolean>;
}
```

### Step 2: Docker Backend

Create `security/sandbox/docker-backend.ts`:

```typescript
import { exec as cpExec } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(cpExec);

export class DockerSandboxBackend implements SandboxBackend {
  private containers: Map<string, string> = new Map(); // sessionId -> containerName

  async init(sessionId: string, config: SandboxConfig): Promise<void> {
    const containerName = `carina-sandbox-${sessionId.slice(0, 8)}`;
    const dockerConfig = config.docker!;

    // 1. Check image exists, build if not
    try {
      await execAsync(`docker image inspect ${dockerConfig.image}`);
    } catch {
      console.log(`Building sandbox image ${dockerConfig.image}...`);
      await execAsync(`docker build -t ${dockerConfig.image} -f docker/Dockerfile.sandbox .`);
    }

    // 2. Create container (don't start yet)
    const mountArg = dockerConfig.mountWorkspace
      ? `-v ${process.env.CARINA_WORKSPACE || '/tmp/carina-workspace'}:/workspace:${config.workspaceAccess === 'readonly' ? 'ro' : 'rw'}`
      : '';

    const createCmd = [
      'docker create',
      `--name ${containerName}`,
      `--memory ${dockerConfig.memoryLimitMb}m`,
      `--cpus ${dockerConfig.cpuLimit}`,
      dockerConfig.networkMode === 'none' ? '--network none' : '',
      mountArg,
      '--stop-timeout 10',
      '--rm', // auto-remove on stop
      dockerConfig.image,
      'tail -f /dev/null', // keep alive
    ].filter(Boolean).join(' ');

    await execAsync(createCmd);
    await execAsync(`docker start ${containerName}`);

    // Wait for container to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    this.containers.set(sessionId, containerName);
  }

  async exec(
    sessionId: string,
    command: string,
    workDir = '/workspace',
    env?: Record<string, string>,
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const containerName = this.containers.get(sessionId);
    if (!containerName) throw new Error(`No sandbox for session ${sessionId}`);

    const envFlags = env
      ? Object.entries(env).map(([k, v]) => `-e ${k}=${shellEscape(v)}`).join(' ')
      : '';

    const timeout = this.getTimeout(sessionId);
    try {
      const { stdout, stderr } = await execAsync(
        `docker exec ${envFlags} -w ${shellEscape(workDir)} ${containerName} ${shellEscape(command)}`,
        { timeout },
      );
      return { stdout, stderr, exitCode: 0 };
    } catch (err: any) {
      return {
        stdout: err.stdout || '',
        stderr: err.stderr || err.message,
        exitCode: err.code || 1,
      };
    }
  }

  async readFile(sessionId: string, path: string): Promise<string> {
    const { stdout } = await this.exec(sessionId, `cat ${shellEscape(path)}`);
    return stdout;
  }

  async writeFile(sessionId: string, path: string, content: string): Promise<void> {
    await this.exec(sessionId, `cat > ${shellEscape(path)}`, '/', {
      CONTENT: content, // passed via heredoc or env
    });
  }

  async teardown(sessionId: string): Promise<void> {
    const containerName = this.containers.get(sessionId);
    if (!containerName) return;

    try {
      await execAsync(`docker stop ${containerName}`, { timeout: 10000 });
    } catch {
      await execAsync(`docker kill ${containerName}`);
    }
    this.containers.delete(sessionId);
  }

  async health(): Promise<boolean> {
    try {
      await execAsync('docker info');
      return true;
    } catch {
      return false;
    }
  }
}
```

### Step 3: Dockerfile.sandbox

Create `docker/Dockerfile.sandbox`:

```dockerfile
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*
RUN useradd -m -s /bin/bash sandbox
USER sandbox
WORKDIR /workspace
```

### Step 4: Sandbox Selection

In `security/sandbox/sandbox-factory.ts`:

```typescript
export function createSandbox(config: SandboxConfig): SandboxBackend {
  switch (config.mode) {
    case 'off':
      return new HostSandboxBackend(); // direct execution (current behavior)
    case 'docker':
      return new DockerSandboxBackend();
    case 'ssh':
      return new SSHSandboxBackend(config.ssh!);
    case 'openshell':
      return new OpenShellBackend(config.openshell!);
  }
}
```

Wire into `agents/tool-runner.ts` -- all exec/file/browser tools route
through the sandbox backend instead of direct process execution.

---

## Existing Carina code to integrate with

- `agents/tool-runner.ts` -- route through sandbox
- `security/kill-switch-listener.ts` -- integrate sandbox_policy
- `agents/session-manager.ts` -- init/teardown sandbox per session
- `config/schema.ts` -- sandbox config keys
- `docker/` -- new Dockerfile.sandbox
- `db/migrations/` -- sandbox_config per agent
