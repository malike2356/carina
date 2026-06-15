# Tools Overview

Carina registers tools with MCP-compatible JSON schemas. The LLM chooses tools; the runtime enforces policy, confirmation, and Scout reporting.

For the full platform inventory, including providers, channels, skill packs, security, and hosted features, see [Capabilities](/capabilities).

## Built-in tools

| Tool | Env key | Sandboxed | Confirmation |
|---|---|---|---|
| `web-search` | `TAVILY_API_KEY` | N/A (external API) | Never |
| `file-read` | None | Path safety only | Never |
| `file-write` | None | System paths blocked | If target file exists |
| `shell-exec` | Docker required | Docker, no network | Always |
| `http-request` | None | HTTPS + SSRF rules; Scout egress when enabled | Never |
| `email-send` | `RESEND_API_KEY` | N/A | Never |
| `email-list` | `RESEND_API_KEY` | N/A | Never |
| `code-exec` | Docker preferred | Docker or VM fallback for JS | If code contains `import`, `require`, or `process` |

## Property pack tools (optional)

Registered when API keys are set:

| Tool | Env key |
|---|---|
| `property-data-lookup` | `PROPERTY_DATA_API_KEY` |
| `land-registry-search` | `LAND_REGISTRY_API_KEY` or `PROPERTY_DATA_API_KEY` |

## Scout integration

When `LABYRINTH_ENABLED=true`:

- Every tool call is reported to Scout with sanitised params.
- `http-request` passes through the egress filter (domain allowlist + DLP).
- `file-read` / `file-write` can trigger honeypot breach events.
- Tool policy enforces blocklist and per-minute/hour rate limits.

## Confirmation flow

Tools marked `dangerous` or with `requiresConfirmation` block until the user approves (CLI y/N, gateway-specific UI elsewhere).

## Logs

| Tool | Log path |
|---|---|
| `shell-exec` | `data/logs/shell.log` |
| Scout suspend | `data/logs/labyrinth-suspend.log` |

See individual tool pages for examples and return shapes.
