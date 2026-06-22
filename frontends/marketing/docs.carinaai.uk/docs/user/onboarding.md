# Onboarding walkthrough

Carina guides new installs through a short first-run flow. You can run it explicitly or let the CLI prompt you on first launch.

## Start onboarding

```bash
carina onboard
```

Useful flags:

| Flag | Purpose |
|---|---|
| `--skip-setup` | Skip interactive questions |
| `--skip-gateway` | Do not start the gateway daemon |
| `--skip-doctor` | Skip health checks at the end |
| `--install-daemon` | Register a systemd user service (Linux) |
| `--json` | Machine-readable output |

## What onboarding covers

1. **Identity** - Your name and what you are building (stored in `~/.carina/`)
2. **Provider** - Choose a default LLM provider and paste an API key
3. **Memory** - Optional Postgres connection for episodic memory
4. **Gateway** - Optional channel gateway startup
5. **Doctor** - Runs `carina doctor` to confirm the install is healthy

## First message

After onboarding, send a test message:

```bash
carina "Hello, confirm you can hear me."
```

Or open the Ink TUI:

```bash
carina
```

With no active session, the TUI shows the launcher first; press `c` to start chat.

## Cloud onboarding

On [app.carinaai.uk](https://app.carinaai.uk), sign up, add at least one BYOK key under **Settings > API keys**, then use the [launcher](/docs/user/carina-cloud) to resume work or start a new chat.

Scout pairing (optional): **Settings > Security** or the security dashboard.

## Troubleshooting

| Issue | Fix |
|---|---|
| Doctor reports missing provider key | Re-run `carina onboard` or set keys in `~/.carina/.env` |
| Gateway will not start | Check port conflicts; see [Gateway hardening](/docs/user/security/gateway-hardening) |
| Memory backend unavailable | Install Postgres + pgvector or run without episodic memory |

## Related

- [Install](/docs/user/install)
- [Model providers](/docs/user/configuration/model-providers)
- [Doctor and health](/docs/user/carina-ops/doctor-and-health)
