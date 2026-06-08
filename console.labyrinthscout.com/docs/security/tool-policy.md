# Tool Policy

Client-side enforcement in Carina (and compatible agents) before a tool executes.

## Rules

| Mechanism | Env var | Behaviour |
|---|---|---|
| Blocklist | `SCOUT_BLOCKLIST` | Comma-separated tool names denied outright |
| Rate limit (minute) | `SCOUT_RATE_LIMIT_MINUTE` | Default `15` calls per session per minute |
| Rate limit (hour) | `SCOUT_RATE_LIMIT_HOUR` | Default `200` calls per session per hour |
| Dangerous commands | built-in | Blocks `rm -rf /`, fork bombs, `dd`, curl-to-shell patterns on `shell-exec` |
| Confirmation | per tool | `shell-exec` always; `file-write` on existing files; `code-exec` when imports detected |

## Errors thrown

| Error | Meaning |
|---|---|
| `ToolBlockedError` | Tool on blocklist |
| `RateLimitError` | Minute or hour cap exceeded |
| `DangerousCommandError` | Shell pattern blocked |
| `ConfirmationRequiredError` | User has not approved yet |

## Scout reporting

Violations can be reported as events with `event_type: tool_policy_violation` so the dashboard shows policy blocks alongside injections.

## Example blocklist

```bash
SCOUT_BLOCKLIST=shell-exec,code-exec
SCOUT_RATE_LIMIT_MINUTE=10
SCOUT_RATE_LIMIT_HOUR=100
```

Restart the agent after changes.

## Server-side policy API

`GET /api/policy` returns the active policy document for an instance (used by admin tools). Enforcement still happens on the agent for lowest latency.
