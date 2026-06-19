# Channel trust, approval, and sandbox defaults

Carina treats inbound messenger traffic as untrusted input. Approval policy and DM pairing contain what unknown peers can trigger.

## Defaults that matter

| Control | Env | Default | Purpose |
|---|---|---|---|
| DM pairing | `CARINA_CHANNEL_DM_PAIRING` | off until onboarding or manual enable | Unknown direct messages stay pending |
| Approval policy | `CARINA_APPROVAL_POLICY` | on (unless `off`) | Dangerous tools need operator approval |
| Exec approval | `CARINA_EXEC_APPROVAL_LEVEL` | `on-miss` | Shell commands with risky patterns need approval |
| Prompt guard | `CARINA_PROMPT_GUARD` | on | Injection patterns filtered before the agent runs |
| Gateway bind | `CARINA_BIND` | unset (see remote-access doc) | Controls who can reach the web UI |

When you pick a messenger channel during `carina onboard`, Carina writes:

```
CARINA_CHANNEL_DM_PAIRING=true
CARINA_APPROVAL_POLICY=on
CARINA_EXEC_APPROVAL_LEVEL=on-miss
```

## DM pairing workflow

1. Unknown peer sends a direct message on Telegram, Discord, Slack, WhatsApp, etc.
2. Carina records the peer as `pending` in `~/.carina/channel-dm-pairing.json`
3. The agent does not process the message until you approve:

```bash
carina channels dm list
carina channels dm approve telegram <peerId>
carina channels dm reject telegram <peerId>
```

Per-channel opt-out:

```bash
CARINA_TELEGRAM_DM_PAIRING=false
```

## Tool and shell approval

Approval policy runs before high-risk tools execute. Operators confirm in the web UI or CLI depending on surface.

Check state:

```bash
carina security doctor
carina security audit
```

Exec levels:

- `off`: standard confirmation only
- `on-miss`: dangerous shell patterns require approval (default)
- `full`: every `shell-exec` requires approval

## Sandbox

Shell and code tools respect the ops sandbox when enabled. Pair sandbox with approval policy for internet-facing gateways.

```bash
carina doctor --deep
```

See also [Defence in depth](./defence-in-depth.md) and [Labyrinth Scout](./labyrinth-scout.md).

## Verify before going live

```bash
carina doctor
carina security doctor
carina channels status
carina agents route --channel telegram --peer direct:12345 --explain
```

Fix any `fail` rows before exposing messengers or the web UI beyond localhost.

## Remote exposure

Gateway bind and TLS guidance: [Remote gateway access](../gateways/remote-access.md).

## Scout boundary

Production monitoring, kill switch, and allowlist enforcement live in Labyrinth Scout. Carina integrates via API; Scout does not replace local DM pairing or approval policy.
