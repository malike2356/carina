# Gap 29 - Prompt 01: Doctor, Health Checks & Heartbeat Docs

**Gap:** 29 Documentation: Operations & Health
**Prompt number:** 01 of 02
**Name:** Write doctor-and-health.md
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1.5 h
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

1. `internal/servers/core.carinaai.uk/src/ops/health-check.ts` -- health checks
2. `internal/servers/core.carinaai.uk/src/security/security-doctor.ts` -- security checks
3. `internal/servers/core.carinaai.uk/src/agents/heartbeat-state.ts` -- heartbeat
4. `internal/servers/core.carinaai.uk/src/agents/check-in.ts` -- check-in system

---

## Goal

Write `docs/user/carina-ops/doctor-and-health.md`.

```markdown
# Carina Doctor & Health Checks

## Overview
Carina includes built-in diagnostics through `carina doctor` and a
continuous health check endpoint. These help verify your installation
is healthy and diagnose problems before they affect operation.

## Carina Doctor

Run a full diagnostic:

```bash
carina doctor
```

### What it checks

| Check | What it verifies |
|-------|-----------------|
| Node.js version | 22.19+ or 24+ |
| CARINA_HOME | Directory exists, writable |
| Configuration | .env file present, required keys set |
| Database | Connection, tables, migrations current |
| Model provider | API key valid, endpoint reachable |
| Gateway | Port available, process running |
| Channel health | Connected channels responding |
| Approval policy | Policy configured, not default |
| Prompt guard | Injection shield active |
| Exec approval | Level set (off, on-miss, full) |
| Egress filter | Domain allowlist configured |
| Scout connection | Scout engine reachable (if enabled) |

### Options

```bash
carina doctor --json        # Machine-readable output
carina doctor --fix         # Auto-repair where possible
carina doctor --quiet       # Only show failures
carina doctor --deep        # Extended checks (network, disk)
```

### Example Output

```
Carina Doctor v1.0
===================
[PASS] Node.js v24.3.0
[PASS] CARINA_HOME: /home/user/.carina
[PASS] Configuration: 24 keys loaded
[PASS] Database: SQLite at ~/.carina/data/carina.db (migration 47)
[PASS] Model provider: Anthropic (api.anthropic.com reachable, 234ms)
[PASS] Gateway: running on port 3333 (pid 12345)
[PASS] Channels: telegram (connected), webchat (connected)
[WARN] Approval policy: using default (consider configuring)
[PASS] Prompt guard: active (regex + LLM judge)
[PASS] Exec approval: level=on-miss
[PASS] Egress filter: 12 domains in allowlist

Summary: 11 passed, 1 warning, 0 failed
```

## Health Check Endpoint

The Gateway exposes a health endpoint:

```bash
curl http://localhost:3333/health
# {"status":"ok","uptime":123456,"version":"1.0.0","channels":{"telegram":"connected"}}
```

Use this for monitoring, load balancers, and container health checks.

### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3333/health || exit 1
```

## Heartbeat

Carina can run scheduled self-checks called heartbeats. Configure in
HEARTBEAT.md or via config:

```bash
carina heartbeat enable --interval hourly
carina heartbeat status
```

The heartbeat agent checks:
- Gateway responsiveness
- Model provider latency
- Channel connectivity
- Disk space and memory
- Pending Scout alerts

Heartbeat results are logged and can trigger notifications on failure.

## Where to find it in source
- `ops/health-check.ts` -- health check runner
- `security/security-doctor.ts` -- security diagnostics
- `agents/heartbeat-state.ts` -- heartbeat engine
- `agents/check-in.ts` -- check-in prompt assembly
```

---

## Sidebar update

Add `'user/carina-ops/doctor-and-health'` under "Carina Ops".

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/ops/health-check.ts`
- `internal/servers/core.carinaai.uk/src/security/security-doctor.ts`
- `internal/servers/core.carinaai.uk/src/agents/heartbeat-state.ts`
