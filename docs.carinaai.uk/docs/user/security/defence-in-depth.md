# Defence-in-depth

Carina layers multiple containment controls when Labyrinth Scout is enabled.

## Layers

| Layer | Module | Env |
|---|---|---|
| 1 Pre-LLM filter | `agent-guard-adapter.ts` + `prompt-guard.ts` | `AGENT_GUARD_ENABLED=true` |
| 2 Tool sequence guard | `tool-sequence-guard.ts` | `TOOL_SEQUENCE_GUARD_ENABLED` (default on with Scout) |
| 3 JIT credentials | `jit-credentials.ts` | `JIT_CREDENTIALS_ENABLED` (default on with Scout) |
| 4 Scout Type 3 pipeline | Scout anomaly + injection events | `LABYRINTH_ENABLED=true` |
| 5 Forensic snapshot | Scout `forensic_snapshots` | automatic on suspend |

## Agent Guard (optional)

Install the Python package on the host running Carina:

```bash
pip install agent-guard-plugins
```

Enable in `.env`:

```bash
AGENT_GUARD_ENABLED=true
AGENT_GUARD_THRESHOLD=0.4
```

If the package is missing, Carina falls back to the built-in `PromptGuard` patterns.

## Tool sequence rules

CloneGuard-style rules block multi-step exfiltration before execution:

- `SEQ-001` sensitive file read then network exfil
- `SEQ-002` sensitive read then email send
- `SEQ-005` config write then privilege escalation shell
- `SEQ-003` rapid read + outbound burst

Blocked sequences are reported to Scout as `tool_sequence_blocked` events.

## JIT credentials

Privileged tools do not have standing access. Each session issues short-lived grants after user confirmation:

- Default tools: `shell-exec`, `email-send`, `file-write`, `http-request`, `code-exec`
- Grants expire after one use or five minutes

Override with `JIT_CREDENTIAL_TOOLS`.
