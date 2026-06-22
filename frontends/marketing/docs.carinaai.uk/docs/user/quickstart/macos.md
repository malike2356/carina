# macOS quickstart

Get from zero to a working chat on macOS in a few minutes.

## 1. Install

```bash
curl -fsSL https://get.carinaai.uk | bash
```

Or:

```bash
npm install -g carina-agent
```

## 2. Onboard

```bash
carina onboard
```

Add an Anthropic, OpenAI, or DeepSeek key when prompted.

## 3. Verify

```bash
carina doctor
carina "Summarize what Carina can do in three bullets."
```

## 4. Optional: desktop app

The Carina desktop app (Tauri) connects to a local gateway. Install from releases, start the gateway with `carina gateway start`, then open the desktop client.

## 5. Optional: channels

Enable Telegram or Discord from `.env` and restart the gateway. See [Gateways](/docs/user/gateways/cli).

## Tips

- Config lives in `~/.carina/`
- Use `carina` with no args for the TUI launcher
- For sandboxed tools, install Docker Desktop

## Next

- [Linux quickstart](/docs/user/quickstart/linux)
- [Configuration](/docs/user/configuration)
