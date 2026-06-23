# Least-privilege tool policy defaults

Carina agents paired with Labyrinth Scout should start with restrictive tool access and expand only when needed.

## Recommended defaults

| Tool | Default | Rationale |
|---|---|---|
| `web-search` | Enabled | Read-only external lookup |
| `file-read` | Scoped paths only | No broad filesystem access |
| `file-write` | Disabled until needed | Prevents exfiltration staging |
| `shell-exec` | Disabled in production | High privilege; enable per workflow |
| `code-exec` | Docker sandbox only | Network-isolated execution |
| `http-request` | Allowlist domains | Scout egress filter enforces |
| `email-send` | Disabled by default | Outbound abuse vector |

## Setup wizard guidance

When running `carina setup`, Scout pairing is optional but recommended. After pairing:

1. Set `LABYRINTH_INSTANCE_ID` to a stable identifier per deployment.
2. Keep `LABYRINTH_ENABLED=true` in production.
3. Configure Scout egress allowlist before enabling `http-request` or `shell-exec`.

## Scout enforcement

Scout layers on top of Carina policy:

- Prompt injection guard (pre-LLM)
- Egress domain blocklist
- Tool quarantine API
- Kill switch with forensic snapshot

See [Type 3 runbook](/trust/type3-runbook) for incident response.
