---
sidebar_position: 2
---

# CLI command reference

## Agent and runtime

| Command | Description |
|---|---|
| `chat` | Interactive REPL (default) |
| `tui` | Rich terminal UI with provider picker |
| `serve` | Local API on port 3000 |
| `web` | Web UI + gateway stack |
| `doctor` | Health check |

## Configuration

| Command | Description |
|---|---|
| `setup` | First-run wizard |
| `config` | `config.yaml` and `.env` management |
| `model` | LLM provider and model |
| `tools` | Toolsets and per-tool toggles |
| `credentials` | API key pools and OAuth device login |
| `memory` | Memory backends |
| `profile` | Isolated install profiles (whole `CARINA_HOME`) |
| `agents` | Named agent workspaces + channel routing (OpenClaw-style) |
| `secrets` | Redacted `.env` listing |

## Gateway and channels

| Command | Description |
|---|---|
| `gateway` | Gateway status and control |
| `channels` | List and configure channels |
| `whatsapp` | Baileys pairing |
| `pairing` | Device pairing codes |

## Operations

| Command | Description |
|---|---|
| `ops` | Sandbox containers, DNS/Tailscale, debug proxy, backup, secrets reload, audit |
| `cron` | Scheduled jobs |
| `checkpoint` | Filesystem snapshots |
| `backup` | Backup `~/.carina` (manifest + verify) |
| `rag` | Vector knowledge search |
| `sessions` | Session index |
| `logs` | Log tail |
| `scout` | Labyrinth Scout integration |
| `security` | Security audit (same checks as `ops audit`) |
| `migrate` | Import from Hermes/OpenClaw |

### `carina commitments` (inferred follow-ups)

OpenClaw-style short-lived follow-up memories. Opt in with `CARINA_COMMITMENTS_ENABLED=true`.

| Subcommand / flag | Description |
|---|---|
| `commitments` / `list` | List pending commitments |
| `commitments --all` | Include sent, dismissed, expired |
| `commitments --agent <id>` | Filter by agent workspace |
| `commitments --status <status>` | `pending`, `sent`, `dismissed`, `snoozed`, `expired` |
| `commitments dismiss <id...>` | Dismiss one or more commitments |
| `--json` | Machine-readable output |

After each agent reply, Carina may run a background extraction pass (heuristic by default; set `CARINA_COMMITMENTS_LLM=true` for LLM extraction). Due check-ins deliver on the same channel/session where they were inferred.

### `carina host` (Node gateway service)

| Subcommand | Description |
|---|---|
| `host status` | PID, uptime, agents, paired devices, channels, cron |
| `host install` | Write `~/.config/systemd/user/carina-gateway.service` |
| `host uninstall` | Remove systemd unit and PID file |
| `host systemd` | Print unit file to stdout |
| `host pid` | Refresh `~/.carina/run/carina-gateway.pid` |

### `carina pairing` (device tokens)

| Subcommand | Description |
|---|---|
| `pairing status` | Pending code and paired device list |
| `pairing code` | Create a 15-minute pairing code |
| `pairing devices` | List paired devices |
| `pairing revoke <id>` | Revoke a device token |

Mobile clients claim codes via `POST /api/pairing/claim` and receive a `cdv_*` bearer token. The web **Control Center** at `/control` shows host metrics, paired devices, pairing, and secrets reload alongside the Scout security dashboard.

### `carina ops` subcommands

| Subcommand | Description |
|---|---|
| `ops sandbox` | List/create/exec/stop Docker sandbox containers |
| `ops dns lookup` | Standard DNS lookup (A/AAAA/CNAME/TXT) |
| `ops dns tailscale` | Tailscale peer list and MagicDNS suffix |
| `ops dns resolve` | Resolve via Tailscale peers then DNS |
| `ops proxy start` | HTTP debug proxy in front of the gateway |
| `ops backup verify` | SHA256 manifest verification |
| `ops secrets reload` | Reload `.env` and credential pools (`--notify` hits gateway) |
| `ops audit` | Full security posture report (`--json`) |

Run `carina <command> --help` or `carina help <command>` for usage strings.
