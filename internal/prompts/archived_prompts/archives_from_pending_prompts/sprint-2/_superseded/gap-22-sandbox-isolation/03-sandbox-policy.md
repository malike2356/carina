# Gap 22 - Prompt 03: Sandbox Policy & Workspace Access Control

**Gap:** 22 Sandbox & Runtime Isolation
**Prompt number:** 03 of 03
**Name:** Per-agent sandbox policy, workspace access gating, sandbox vs tool policy vs elevated
**Primary agent:** Claude Code
**Estimated hours:** 2 h
**Depends on:** 01-sandbox-architecture.md, 02-ssh-openshell-backends.md

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

### 1. Sandbox Policy Matrix

Define which sessions/agents get sandboxed and how:

| Scope | Description |
|-------|-------------|
| `off` | No sandbox. Direct exec on host (legacy/default). |
| `non-main` | Sandbox all agents except the primary/default agent. |
| `all` | Sandbox every agent including the primary. |

```typescript
// security/sandbox/sandbox-policy.ts
export type SandboxPolicy = 'off' | 'non-main' | 'all';

export function shouldSandbox(
  agentId: string,
  isDefaultAgent: boolean,
  policy: SandboxPolicy,
): boolean {
  switch (policy) {
    case 'off': return false;
    case 'non-main': return !isDefaultAgent;
    case 'all': return true;
  }
}
```

### 2. Workspace Access Control

Control whether the sandbox can access the workspace:

| Level | Effect |
|-------|--------|
| `none` | No workspace access. Fresh temp dir per session. |
| `readonly` | Workspace mounted read-only. |
| `readwrite` | Workspace mounted read-write (default for Docker). |

Configured per agent:

```yaml
agents:
  list:
    - id: default
      sandbox:
        mode: off             # primary agent runs un-sandboxed
        workspaceAccess: readwrite

    - id: code-reviewer
      sandbox:
        mode: docker
        scope: session
        workspaceAccess: readonly   # can read code, can't modify

    - id: untrusted-plugin-runner
      sandbox:
        mode: docker
        scope: session
        workspaceAccess: none       # fully isolated
        docker:
          networkMode: none         # no network
          memoryLimitMb: 256
```

### 3. Sandbox vs Tool Policy vs Elevated

Three layers of security, applied in order:

```
1. Tool Policy (allowlist/blocklist)
   ↓ Which tools can this agent call?
2. Sandbox (isolation)
   ↓ Where do tool calls execute?
3. Elevated Mode (permission escalation)
   ↓ Does this tool need elevated privileges?

Decision matrix:
- If tool is NOT in allowlist → BLOCKED
- If sandbox mode is 'off' → exec on host
- If sandbox mode is 'docker' → exec in container
- If elevated mode is required AND not approved → APPROVAL NEEDED
```

### 4. Sandbox Status CLI

```
carina sandbox status              Show current sandbox config
carina sandbox test                Run diagnostic: can Docker pull/start?
carina sandbox list-sessions       Show sandboxed sessions + resource usage
carina sandbox prune               Clean up orphaned containers
```

---

## Existing Carina code to integrate with

- `agents/tool-runner.ts` -- apply sandbox policy before exec
- `security/sandbox/sandbox-policy.ts` -- new file
- `agents/config-schema.ts` -- sandbox config per agent
- `cli/commands.ts` -- `sandbox` command group
- `agents/session-manager.ts` -- enforce sandbox per session creation
