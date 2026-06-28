# SOP 008: Background Process Management
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/BACKGROUND_PROCESSES.md
**Last reviewed:** 2026-06-25

---

# Background Process Management

Carina tracks long-running shell commands started with `shell-exec` (`background=true`). Processes receive stable `session_id` values, can be watched, cancelled, and recovered after restart.

## Starting processes

Use the `shell-exec` tool with `background=true`. Optional fields:

| Field | Purpose |
|-------|---------|
| `label` | Operator-friendly name shown in list/detail views |
| `dedupe_key` | Idempotency key; returns an existing running process instead of spawning a duplicate |
| `notify_on_complete` | Channel message when the process exits successfully |
| `notify_on_failure` | Channel message on non-zero exit or spawn error |
| `watch_patterns` | Regex rules evaluated on each output line |

Watch rule actions:

- `notify` (default): emit `process.watch` webhook and optional channel message
- `kill`: terminate the process when the pattern matches

## Managing processes

Use the `process` tool:

- `list` / `detail` / `poll` / `log` / `wait` / `kill` / `write` / `submit` / `close`

CLI: `carina tasks background` lists in-memory processes.

HTTP API (operator auth required):

- `GET /api/processes` - recent processes (live + persisted)
- `GET /api/processes/:sessionId` - detail
- `GET /api/processes/:sessionId/log` - output buffer
- `POST /api/processes/:sessionId/kill` - cancel

All API calls should target `https://core.carinaai.uk/api/processes` in production.

## Persistence and recovery

When Postgres is available, process metadata is stored in `background_processes`. On startup, Carina:

1. Loads rows with `status = running`
2. Re-attaches live PIDs into the in-memory registry (`detached` mode)
3. Marks dead PIDs as `orphaned`

A reconcile loop polls detached processes every 5 seconds.

## Webhooks

- `process.complete` - successful exit with `notify_on_complete`
- `process.failure` - failed exit with `notify_on_failure`
- `process.watch` - pattern match from `watch_patterns`

Webhook delivery is logged in `webhook_deliveries` with status, HTTP code, attempts, and errors. See `SOP/010-webhooks.md` for webhook management.

## Limits

- Max 10 concurrent background processes
- Output buffer: 1000 lines per process
- Exited entries are swept from memory after 5 minutes
