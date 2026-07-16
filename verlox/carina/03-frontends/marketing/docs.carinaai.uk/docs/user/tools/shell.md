# Shell Execution

Runs a shell command in a sandboxed Docker container with no network access.

## Requirements

- Docker must be installed and running (`docker info` succeeds at startup).
- Without Docker: `shell-exec` returns exit code 1 with stderr explaining Docker is unavailable (hard disabled, not a degraded host shell).

## Security

- Runs in `alpine:latest` with `--network=none`, `--memory=128m`, read-only root where configured.
- Refuses execution when the process uid is root.
- Dangerous patterns are blocked before Docker is invoked, including:
  - `rm -rf /` and variants
  - Fork bombs
  - Disk destroyers (`dd if=`, `mkfs`)
  - `curl`/`wget` piped to shell
- All executions append to `data/logs/shell.log`.
- **Always requires confirmation** - Carina prompts `Run this tool? (y/N):` before running.
- Scout tool policy may block `shell-exec` entirely via `SCOUT_BLOCKLIST`.

## Example

> "Run ls -la on the /tmp directory"

After you confirm with `y`, Carina returns `stdout`, `stderr`, and `exitCode`.

## Timeout

30 seconds per invocation.
