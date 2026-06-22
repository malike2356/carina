**Status: COMPLETED 2026-06-21**


# Gap 29 - Prompt 02: Logging, Diagnostics Export & Troubleshooting Docs

**Gap:** 29 Documentation: Operations & Health
**Prompt number:** 02 of 02
**Name:** Write logging-and-monitoring.md
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


## Goal

Write `docs/user/carina-ops/logging-and-monitoring.md`.

```markdown
# Logging, Diagnostics & Troubleshooting

## Logging

Carina writes structured logs to `~/.carina/logs/`:

```bash
# View live logs
carina logs --follow

# Filter by level
carina logs --level warn

# Filter by component
carina logs --component gateway
carina logs --component agent
carina logs --component channel:telegram

# Last N lines
carina logs --tail 100

# Time range
carina logs --since "2026-06-20T00:00:00Z" --until "2026-06-21T00:00:00Z"
```

### Log Levels

| Level | Meaning |
|-------|---------|
| debug | Detailed diagnostics (development only) |
| info | Normal operations |
| warn | Non-critical issues |
| error | Failures that need attention |
| fatal | Gateway cannot continue |

### Log Format

Logs are structured JSON (one per line):

```json
{
  "timestamp": "2026-06-21T14:30:00.000Z",
  "level": "info",
  "component": "gateway",
  "message": "Channel telegram connected",
  "sessionId": "sess_abc123",
  "durationMs": 234
}
```

Use `jq` to query logs:

```bash
# All errors in last hour
carina logs --since "1h ago" --level error | jq '.'

# Slow model calls
carina logs --component agent | jq 'select(.durationMs > 5000)'
```

## Diagnostics Export

Generate a diagnostics bundle for support:

```bash
carina diagnostics export
# Writes to ~/.carina/diagnostics/carina-diag-20260621-143000.tar.gz
```

The bundle includes (redacted):
- Configuration (API keys redacted)
- Recent logs
- Database statistics
- Gateway status
- Channel health
- Environment info (OS, Node version, memory)

Send this file when reporting issues.

## Monitoring Integrations

### Prometheus Metrics

Enable Prometheus metrics at `/metrics`:

```bash
export CARINA_PROMETHEUS_ENABLED=true
carina gateway restart
curl http://localhost:3333/metrics
```

Available metrics:
- `carina_gateway_uptime_seconds`
- `carina_sessions_active`
- `carina_sessions_total`
- `carina_llm_requests_total{model,provider}`
- `carina_llm_duration_seconds{model,provider}`
- `carina_tool_calls_total{tool}`
- `carina_tool_errors_total{tool}`
- `carina_channel_messages_total{channel}`
- `carina_memory_operations_total{backend,operation}`
- `carina_sandbox_containers_active`

### OpenTelemetry

Export traces and metrics to any OTLP-compatible backend:

```bash
export CARINA_OTEL_ENABLED=true
export CARINA_OTEL_ENDPOINT="http://jaeger:4318/v1/traces"
carina gateway restart
```

## Troubleshooting

### Common Issues

#### Gateway won't start
```bash
carina doctor                    # Run diagnostics
carina doctor --fix              # Auto-repair
sudo lsof -i :3333               # Check if port is in use
carina gateway start --port 3334 # Try alternate port
```

#### Channel disconnected
```bash
carina channel status <name>     # Check status
carina channel test <name>       # Test connectivity
carina channel remove <name>     # Remove and re-add
carina channel add <name>
```

#### Model provider timeout
```bash
carina doctor --deep             # Check provider latency
curl -I https://api.anthropic.com  # Direct connectivity check
export CARINA_PROVIDER_TIMEOUT=120000  # Increase timeout (ms)
```

#### High memory usage
```bash
carina doctor --deep              # Check memory stats
carina sessions prune --older-than 30d  # Clean old sessions
carina memory vacuum              # Reclaim database space
```

#### Stuck agent turn
```bash
carina session list               # Find stuck session
carina session abort <id>         # Force-abort
carina gateway restart            # Nuclear option
```

## Where to find it in source
- Logging configuration in `config/schema.ts`
- Metrics in `infrastructure/metrics.ts`
- Diagnostics in `ops/diagnostics.ts`
```

---

## Sidebar update

Add `'user/carina-ops/logging-and-monitoring'` under "Carina Ops".

---

## Existing Carina files to reference

- `internal/servers/core.carinaai.uk/src/infrastructure/metrics.ts` (if exists)
- `internal/servers/core.carinaai.uk/src/ops/`
- `internal/servers/core.carinaai.uk/src/config/schema.ts`
