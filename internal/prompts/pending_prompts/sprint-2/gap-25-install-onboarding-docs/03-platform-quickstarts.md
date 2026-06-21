# Gap 25 - Prompt 03: Platform Quickstarts

**Gap:** 25 Documentation: Install, Onboarding & Quickstart
**Prompt number:** 03 of 03
**Name:** Write platform-specific quickstart guides
**Primary agent:** Claude Code (docs writing)
**Estimated hours:** 1 h
**Depends on:** 01-install-page.md, 02-onboarding-walkthrough.md

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

Write three platform-specific quickstart pages:

### 1. `docs/user/quickstart/macos.md`

```markdown
# macOS Quickstart

## Prerequisites
- macOS 13 (Ventura) or later
- Terminal.app or your preferred terminal

## Install
curl -fsSL https://get.carinaai.uk | bash

## Start the Gateway
carina gateway start

## Run as a background service (optional)
carina gateway install
# This creates a launchd service: ~/Library/LaunchAgents/ai.carina.gateway.plist
# Starts automatically on login

## Connect Telegram
carina channel add telegram
# Paste your bot token from @BotFather

## Send a test message
Open Telegram and chat with your bot. Carina replies.

## Uninstall
carina gateway uninstall
npm uninstall -g @verlox/carina
rm -rf ~/.carina
```

### 2. `docs/user/quickstart/linux.md`

```markdown
# Linux Quickstart

## Prerequisites
- Ubuntu 22.04+, Debian 12+, or any systemd-based distribution
- Node.js 22+ (use nvm or nodesource)

## Install
curl -fsSL https://get.carinaai.uk | bash

## Run as a systemd service (recommended for servers)
carina gateway install
# Creates ~/.config/systemd/user/carina-gateway.service
# Enable linger if running headless: loginctl enable-linger

systemctl --user enable --now carina-gateway
systemctl --user status carina-gateway

## Connect Telegram
carina channel add telegram

## Headless access
# SSH into your server and use the CLI:
carina chat "What can you help me with?"

# Or connect WebChat by visiting http://your-server:3333/chat

## Firewall
# If exposing WebChat:
sudo ufw allow 3333/tcp
```

### 3. `docs/user/quickstart/windows.md`

```markdown
# Windows Quickstart

## Prerequisites
- Windows 11 or Windows 10 (build 19041+)
- PowerShell 7+ or Windows Terminal
- Node.js 22+ (install from nodejs.org)

## Option 1: WSL2 (recommended)
wsl --install -d Ubuntu
# Follow the Linux Quickstart inside WSL2

## Option 2: Native PowerShell
iwr -useb https://get.carinaai.uk/install.ps1 | iex

## Start the Gateway
carina gateway start

## Connect Telegram
carina channel add telegram

## Run as a scheduled task (optional)
carina gateway install
# Creates a scheduled task: "Carina Gateway"
# Starts automatically on login
```

### Key rules
- Each quickstart ends with a working Carina responding to messages
- Include uninstall/recovery steps
- Platform-specific service setup (launchd / systemd / scheduled task)
- Cross-link to full install page for alternative methods
- No emojis, no competitor names

---

## Sidebar update

Add a "Quickstarts" category under "Getting started" in `sidebars.ts`:

```typescript
{
  type: 'category',
  label: 'Quickstarts',
  items: [
    'user/quickstart/macos',
    'user/quickstart/linux',
    'user/quickstart/windows',
  ],
},
```

Also create `docs/user/quickstart/_category_.json`:
```json
{ "label": "Quickstarts", "position": 3 }
```

---

## Existing Carina files to reference

- `scripts/deploy-carina.sh` -- Unix server deployment
- `docker/Dockerfile.runtime` -- Docker runtime configuration
- `internal/servers/core.carinaai.uk/src/infrastructure/` -- service setup
