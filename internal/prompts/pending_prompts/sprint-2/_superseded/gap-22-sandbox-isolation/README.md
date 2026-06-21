# Gap 22 - Sandbox & Runtime Isolation

**Gap:** 22
**Sprint:** 2
**Source:** OpenClaw docs (sandboxing: Docker/SSH/OpenShell backends)
**Goal:** Add runtime sandbox isolation so agent tool calls (exec, file ops,
  browser) run inside Docker containers or remote SSH hosts instead of directly
  on the gateway host.

**Primary agent:** Claude Code
**Estimated hours:** 6-8 h total

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Context

Carina has RASP-based security (kill switch, tool quarantine, egress filtering)
but no sandbox isolation. Agent exec/file/browser operations run directly on the
gateway host process. OpenClaw provides three backends:

- **Docker**: Spawn per-session containers, mount workspace
- **SSH**: Proxy commands to a remote host
- **OpenShell**: Lightweight process isolation without containers

---

## Build Order

```
01-sandbox-architecture.md   Sandbox interface, backend selection, Docker backend
02-ssh-openshell-backends.md  SSH proxy + OpenShell backends
03-sandbox-policy.md          Per-agent sandbox policy, workspace access control
```
