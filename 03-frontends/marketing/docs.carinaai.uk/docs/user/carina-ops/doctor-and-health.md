# Doctor and health checks

`carina doctor` validates your install before you debug mysterious gateway failures.

## Basic usage

```bash
carina doctor
carina doctor --json
carina doctor --fix    # safe auto-repairs where implemented
carina doctor --deep   # extended checks (slower)
```

## What doctor checks

| Area | Examples |
|---|---|
| Runtime | Node version, writable `~/.carina/` |
| Providers | API keys present for default provider |
| Database | Postgres connectivity when configured |
| Redis | Ping when `REDIS_URL` set |
| Gateway | Port listening, health endpoint |
| Security | Scout pairing status, obvious misconfigurations |

Security-focused checks also exist under `carina security doctor` (see `security/security-doctor.ts`).

## HTTP health endpoint

When the gateway is running:

```bash
curl -s http://localhost:3333/health | jq .
```

Hosted and ops deployments may expose additional readiness routes behind auth.

## Heartbeat and check-in

Long-running agents can emit heartbeat state for ops dashboards (`agents/heartbeat-state.ts`, check-in modules). Configure intervals via env documented in [configuration](/docs/user/configuration).

## Runbook

1. `carina doctor --json` and save output
2. Fix critical failures first (provider keys, DB)
3. Restart gateway: `carina gateway restart`
4. Re-run doctor until clean

## Related

- [Logging and monitoring](/docs/user/carina-ops/logging-and-monitoring)
- [Troubleshooting](/docs/user/troubleshooting)
