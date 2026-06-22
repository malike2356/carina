# Logging and monitoring

Operate Carina with structured logs, diagnostics export, and optional OpenTelemetry.

## Log locations

| Surface | Default path |
|---|---|
| Self-host CLI / gateway | `~/.carina/data/logs/` (e.g. `shell.log`, turn logs when enabled) |
| Docker | Container stdout + mounted volume under `/home/node/.carina/data/logs/` |
| Cloud | Ops panel log streamer and workspace audit exports |

Enable turn telemetry (development):

```
CARINA_TURN_LOG=true
CARINA_TURN_LOG_SLOW_MS=8000
```

Writes JSONL to `<CARINA_HOME>/data/logs/turns.jsonl` without blocking chat latency.

## Log levels

Set `LOG_LEVEL=debug|info|warn|error` in `.env`. Gateway and channel adapters respect the same logger.

## OpenTelemetry

Optional trace export:

```
OTEL_ENABLED=true
OTEL_SERVICE_NAME=carina-core
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318
```

Spans mirror internal Carina trace events when enabled.

## Monitoring checklist

- Gateway `/health` uptime probe
- Postgres and Redis alerts in production
- Scout console heartbeat for security plane
- Disk usage on `~/.carina/data/`

## Diagnostics bundle

For support, collect:

```bash
carina doctor --json > doctor.json
tar czf carina-logs.tgz ~/.carina/data/logs/
```

Redact API keys before sharing.

## Related

- [Doctor and health](/docs/user/carina-ops/doctor-and-health)
- [Audit and exports](/docs/user/carina-ops/audit-and-exports)
