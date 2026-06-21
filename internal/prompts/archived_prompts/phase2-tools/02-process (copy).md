# Action: Process Management Tool (Standalone Carina)

## Status: DONE

Background process management is fully implemented.

## Implementation

| Component | Path |
|---|---|
| Process tool | `src/tools/process.ts` |
| Shared registry | `src/tools/process-registry.ts` |
| Background spawn | `shell-exec` with `background=true` in `src/tools/shell.ts` |

## Behaviour

- **shell-exec background:** `shell-exec({ command, workdir, background: true })` returns `session_id`
- **process actions:** `list`, `poll`, `log`, `wait`, `kill`, `write`, `submit`, `close`
- **Registry:** circular 1000-line buffer, incremental poll cursor, 5-minute cleanup of exited processes
- **Kill:** SIGTERM with 5s grace, then SIGKILL
- **Security:** dangerous tool; kill/write/submit/close require confirmation; refuses root for shell-exec

## Foreground shell-exec additions

- `workdir` with path validation (bind-mounted read-only in Docker sandbox)
- `timeout` capped at 600 seconds
- stdout/stderr capped at 50KB with truncation marker

## When to use

- Long-running servers, watchers, or interactive CLIs started in background
- Poll incremental output without flooding parent context
- Send stdin to prompts, then wait or kill

## When not to use

- One-shot commands (use foreground `shell-exec`)
- Scheduled recurring work (use `cronjob`)
- Parallel isolated sub-tasks (use `delegate-task`)
