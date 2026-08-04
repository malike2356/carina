# Messaging gateway and provider choice

Carina talks to you on messengers, CLI, TUI, web, and mobile through one gateway. Provider choice is per-session and reversible.

## Supported messengers

Telegram, Discord, Slack, WhatsApp, Signal, SMS, IRC, and the full channel catalog under `carina channels list`.

Setup path:

```bash
carina onboard
carina channels setup telegram
carina gateway start
carina channels status
```

Each channel guide: [channel-setup.md](./gateways/channel-setup.md).

## Messenger slash commands

| Command | Purpose |
|---|---|
| `/help` | Command list (compact on Telegram/SMS/Signal) |
| `/model [provider] [model]` | Switch LLM for this session |
| `/provider` | Show configured providers |
| `/new`, `/reset` | Fresh conversation (new session id) |
| `/stop` | Interrupt the current reply |
| `/status` | Session id, active provider, continuity mode |
| `/memories` | Recent episodic memory |
| `/usage --month` | Token usage summary |

Web chat uses the same `/model` flow plus the provider dropdown in the header. CLI and TUI support the same commands.

## Provider switching

Mid-session switch (any surface):

```
/model deepseek
/model anthropic claude-sonnet-4-6
/provider
/provider list
```

CLI menu:

```bash
carina model menu
carina model pick
carina providers list
```

Provider rotation / failover (in `~/.carina/.env` or container env):

```
# Lock to one provider+model (no failover):
CARINA_LLM_ROTATION_ENABLED=false
DEFAULT_PROVIDER=deepseek
DEFAULT_PROVIDER=deepseek
DEEPSEEK_MODEL=deepseek-chat
CARINA_LLM_ROTATION_ENABLED=false

# Or enable failover across a selected allowlist:
CARINA_LLM_ROTATION_ENABLED=true
CARINA_LLM_ROTATION_PROVIDERS=gemini,deepseek,anthropic,openai
```

CLI: `carina providers rotation on|off|set gemini,deepseek,anthropic|clear|status`

Legacy alias: `CARINA_PROVIDER_FALLBACK` is still read when `CARINA_LLM_ROTATION_PROVIDERS` is unset.

Check status on a messenger:

```
/status
```

## Cross-surface continuity

By default each surface keeps its own gateway session (CLI vs Telegram vs web tab).

Unified operator mode shares one session everywhere:

```
CARINA_OPERATOR_SESSION=true
```

When enabled, phone, laptop CLI, and web chat continue the same thread. See [surfaces-decision.md](./surfaces-decision.md).

Mobile companion: `carina pair` then open `/mobile` on the gateway host.

## Security before exposing messengers

Enable DM pairing for internet-facing channels. See [channel-trust-and-approval.md](./security/channel-trust-and-approval.md) and [remote-access.md](./gateways/remote-access.md).

## Related

- Provider matrix: [providers-streaming-matrix.md](./providers-streaming-matrix.md)
- Operator TUI: [operator-tui.md](./operator-tui.md)
- Remote access: [remote-access.md](./gateways/remote-access.md)
