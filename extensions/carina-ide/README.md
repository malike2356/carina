# Carina IDE Extensions

Official Carina integrations for VS Code and Cursor. Connect to a running Carina gateway (`carina web` or `carina serve`) and chat with your agent from the editor.

## Features

- Sidebar chat panel with streaming replies
- Ask about the current editor selection (right-click or command palette)
- List registered Carina tools
- Connection health check
- Configurable server URL and LLM provider override

## Prerequisites

1. Install Carina: `npm install -g carina` (or run from `core.carinaai.uk`)
2. Start the gateway: `carina web` (default `http://localhost:3000`)
3. Configure an LLM API key in `~/.carina/.env`

## Install (VS Code)

```bash
cd extensions/carina-ide
pnpm install
pnpm package
code --install-extension carina-vscode-0.1.0.vsix
```

Or from the repo root:

```bash
carina ide install vscode
```

## Install (Cursor)

```bash
cd extensions/carina-ide
pnpm install
pnpm package:cursor
cursor --install-extension carina-cursor-0.1.0.vsix
```

Or:

```bash
carina ide install cursor
```

## Settings

| Setting | Default | Description |
|---|---|---|
| `carina.serverUrl` | `http://localhost:3000` | Carina HTTP gateway |
| `carina.provider` | (empty) | Optional provider override |
| `carina.sessionId` | (auto) | Fixed IDE session id |

## API

The extension uses Carina ACP-IDE endpoints:

- `GET /api/health`
- `GET /acp/ide/capabilities`
- `POST /acp/ide/chat` (JSON or SSE stream)
- `GET /acp/tools`
