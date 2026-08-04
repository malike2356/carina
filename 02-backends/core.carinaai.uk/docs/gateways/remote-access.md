# Remote gateway access

Use this runbook when Carina runs on one machine and you chat from another (phone, laptop, VPS, or a messaging webhook).

## Default: local only

By default the web gateway binds to localhost. This is the safest default.

```bash
carina gateway status
carina host status
```

Typical local URL: the local URL printed by `carina web` (or your pinned `WEB_PORT`).

## Recommended patterns (in order)

### 1. Messaging channels (preferred)

Connect Telegram, Discord, Slack, or WhatsApp instead of exposing the web port.

```bash
carina onboard                    # guided setup
carina channels setup telegram    # env vars + webhook notes
carina gateway start
carina channels status
```

Inbound DMs from unknown peers are held until approved:

```bash
carina channels dm list
carina channels dm approve telegram <peerId>
```

See [Channel setup](./channel-setup.md).

### 2. Tailscale or VPN (recommended for remote web UI)

Put both devices on the same tailnet or VPN, then browse to the host private IP:

```
http://100.x.x.x:<gateway-port>
```

Set a web password before relying on network isolation alone:

```bash
CARINA_WEB_PASSWORD=your-strong-password
```

### 3. SSH tunnel (one-off remote access)

From your laptop:

```bash
ssh -L <local-port>:127.0.0.1:<gateway-port> user@gateway-host
```

Open `http://localhost:<local-port>` locally. No public port required.

### 4. Reverse proxy with TLS (production)

Terminates HTTPS on nginx or Caddy and proxies to Carina on localhost.

Requirements:

- Valid TLS certificate (Let's Encrypt or Cloudflare)
- `CARINA_WEB_PASSWORD` or ops token for browser auth
- Rate limiting at the proxy
- Optional: Labyrinth Scout for production monitoring

See [Self-Hosting](/self-hosting) for Docker/nginx examples.

## What not to do

- Do not expose the web gateway port directly to the public internet without TLS and auth.
- Do not disable DM pairing (`CARINA_CHANNEL_DM_PAIRING`) on internet-facing messengers.
- Do not run shell-capable tools against untrusted inbound messages without approval enabled.

See [Channel trust and approval](../security/channel-trust-and-approval.md).

## Agent routing from remote channels

Each inbound message resolves to an agent workspace using explicit bindings in `~/.carina/agents.json`.

Test before going live:

```bash
carina agents list --bindings
carina agents route --channel telegram --peer direct:12345 --explain
carina agents bind add work telegram
```

Precedence: ownership, contact, peer, guild, team, account, channel, default.

## Background daemon

Keep the gateway running after logout:

```bash
carina host install
carina host start
carina host status
```

Or during onboarding:

```bash
carina onboard --install-daemon
```

## Checklist before remote use

1. `carina doctor` passes
2. Provider key configured in `~/.carina/.env`
3. Channel env vars set; `carina channels status` shows connected or configured
4. DM pairing policy understood for your channels
5. Web auth set if the UI is reachable beyond localhost
6. Routing rules tested with `carina agents route`
7. Scout optional but recommended for internet-facing deployments

## Related docs

- [Channel setup](./channel-setup.md)
- [CLI gateway](./cli.md)
- [Configuration](/configuration)
- [Labyrinth Scout](/security/labyrinth-scout)
