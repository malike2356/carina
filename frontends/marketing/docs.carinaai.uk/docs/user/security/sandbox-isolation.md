# Sandbox isolation

Dangerous tools (`shell-exec`, `code-exec`, and similar) can run inside isolated backends instead of on the gateway host.

## Modes

| Mode | Description |
|---|---|
| **Host** | Tools run on the gateway machine (dev only) |
| **Docker** | Commands execute in ephemeral containers |
| **SSH / remote** | Forward execution to a hardened worker host |
| **Disabled** | Tool blocked by policy |

Configure via env and ops modules under `src/ops/sandbox*`.

## Docker sandbox (recommended)

Requires Docker daemon on the gateway host or sidecar:

```
SANDBOX_MODE=docker
DOCKER_HOST=unix:///var/run/docker.sock
```

Images and resource limits are defined in ops config; see deploy docs in your `docker-compose` bundle.

## Policy integration

Scout tool policy and sequence guards apply before sandbox spawn. JIT credentials may inject short-lived secrets into the sandbox environment.

## Cloud

Carina Cloud terminal and core-proxy modes expose sandboxed shell only when workspace policy allows (`useTerminalAccess` in the web app).

## Verification

```bash
carina doctor --deep
# Trigger a safe shell tool in dev and confirm container id in logs
```

## Related

- [Shell tool](/docs/user/tools/shell)
- [Defence in depth](/docs/user/security/defence-in-depth)
- [Gateway hardening](/docs/user/security/gateway-hardening)

## Source references

- `ops/sandbox*.ts`
- `tools/shell*.ts`

:::note
Gap-22 sandbox prompts may supersede older isolation docs; prefer this page for current env flags in your tree.
:::
