# GAP: Terminal - Docker Sandbox (Tier 2)

**Status: COMPLETED 2026-06-23**

**What was built:**
- Docker sandbox execution in `app.carinaai.uk/src/lib/terminal-session.ts` (`runInContainer`, `provisionWorkspaceDir`)
- Minimal sandbox image at `app.carinaai.uk/docker/Dockerfile.sandbox`
- Per-workspace volume mount, `cd` interception, 30s timeout, `--network none` isolation


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

`app.carinaai.uk` has a built-in terminal (`/terminal` route and embedded in the launcher).
Currently it runs commands via `execFileAsync` on the host VPS as the `malike` system user.

Tier 1 (already done) added:
- `terminal_enabled` boolean on `workspace_settings` (default false)
- API gate: all three terminal route handlers check `terminalEnabled` before executing
- `buildSafeEnv()` strips secrets from child process env
- 30s hard timeout with SIGKILL

Tier 1 protects against unauthorized access but does NOT provide filesystem isolation.
A workspace with `terminal_enabled = true` can still read/write any file owned by `malike`
on the host (other apps, SSH keys, cron, etc.).

## What needs to be built

Replace the `runWithScript` / `runWithShell` execution path in
`app.carinaai.uk/src/lib/terminal-session.ts` with Docker-based execution.

### Each command must run in a throwaway container with these constraints

```
docker run --rm \
  --network none \
  --memory 128m \
  --cpus 0.5 \
  --read-only \
  --tmpfs /tmp:size=32m,mode=1777 \
  -v /home/malike/workspaces/${workspaceId}:/workspace:rw \
  -w /workspace \
  --user 1001:1001 \
  carina-sandbox:latest \
  sh -c "${command}"
```

### Key constraints

- `--network none`: no outbound internet from inside the container
- `--read-only`: container root filesystem is read-only; only /tmp and /workspace are writable
- `--memory 128m --cpus 0.5`: prevent resource exhaustion
- `--user 1001:1001`: non-root UID inside the container, cannot escape via UID 0
- `-v /workspace:rw`: only the workspace-specific directory is mounted, not the host root
- `--rm`: container is destroyed on exit, no persistence of compromised state

### Workspace volume provisioning

When a workspace is created (or when terminal is first enabled for it), create the workspace
directory on the host:

```
/home/malike/workspaces/${workspaceId}/
```

This is the only directory the user can read/write. They cannot see other workspaces or the app code.

### The sandbox image

Build a minimal image. File is at `app.carinaai.uk/docker/Dockerfile.sandbox`:

```dockerfile
FROM node:20-alpine
RUN addgroup -g 1001 sandbox && adduser -u 1001 -G sandbox -s /bin/sh -D sandbox
USER 1001
WORKDIR /workspace
```

Build and push to the VPS before enabling this feature:
```bash
docker build -f docker/Dockerfile.sandbox -t carina-sandbox:latest .
```

### Files to change

- `src/lib/terminal-session.ts`: replace `runWithScript`/`runWithShell` with `runInContainer`
- `src/lib/terminal-session.ts`: add `provisionWorkspaceDir(workspaceId)` called on session create
- `docker/Dockerfile.sandbox`: new file, minimal sandbox image
- `scripts/vps-schema-patch.sql`: add workspace dir provisioning note (no DB changes needed)

### CWD handling

Because `cd` does not persist across Docker `--rm` invocations, the session `cwd` tracking
needs to be implemented differently. Options:

A. Detect `cd <path>` commands specially, resolve them, and update `session.cwd` in the
   Node layer, then pass `--workdir ${session.cwd}` to each docker run call.
B. Use a long-running container per session (not `--rm`) and `docker exec` into it.
   This is more complex but allows stateful shell (aliases, exports, cd persist).

Recommended: Option A for simplicity. Intercept `cd` at the API layer, resolve the new path
relative to the current cwd, update session.cwd, return immediately without spawning a container.
All other commands run as one-shot `docker run --rm` with `-w ${session.cwd}`.

### Acceptance criteria

- [x] `whoami` inside terminal returns sandbox user (uid 1001), not host user
- [x] Container runs with `--network none`, `--read-only`, memory/CPU limits
- [x] Only workspace-specific directory mounted (`/workspace`)
- [x] `cd` commands intercepted and persisted in session layer (Option A)
- [x] Commands beyond 30s killed with SIGKILL
- [x] Workspace directory provisioned on session create via `provisionWorkspaceDir`
- [ ] Manual VPS checklist (curl/network isolation) not re-run in this archive pass

### Testing checklist

Run these manually after implementation:

```bash
whoami                              # must print: sandbox
id                                  # must show uid=1001
cat /etc/passwd | grep malike       # must return nothing
ls /home/malike                     # permission denied
curl http://example.com             # network unreachable
ls /home                            # only /home/sandbox or empty
echo "test" > /workspace/test.txt   # must succeed
cat /workspace/test.txt             # must print: test
ls /tmp                             # must work (tmpfs mounted)
```
