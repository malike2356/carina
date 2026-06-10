# Carina JetBrains Plugin

Official Carina integration for IntelliJ IDEA, WebStorm, PyCharm, Rider, and other JetBrains IDEs.

## Features

- Right-side **Carina** tool window with streaming chat
- **Ask Carina About Selection** in the editor context menu
- **Settings > Tools > Carina** for server URL and provider override
- Menu actions: Open Chat, Check Connection, List Tools

## Prerequisites

1. Carina gateway running: `carina web` or `carina serve` (default `http://localhost:3000`)
2. JDK 17+ to build the plugin (Gradle toolchain auto-downloads if needed)

## Build

```bash
cd extensions/carina-jetbrains
bash scripts/build.sh
```

Output: `build/distributions/carina-jetbrains-0.1.0.zip`

Or from the repo root:

```bash
carina ide build jetbrains
```

## Install

1. JetBrains IDE: **Settings > Plugins > gear icon > Install Plugin from Disk...**
2. Select `build/distributions/carina-jetbrains-0.1.0.zip`
3. Restart the IDE
4. Open **View > Tool Windows > Carina**

CLI helper:

```bash
carina ide install jetbrains
```

## Settings

| Setting | Default | Description |
|---|---|---|
| Server URL | `http://localhost:3000` | Carina HTTP gateway |
| Provider override | (empty) | Optional LLM provider |
| Session ID | (auto) | Fixed IDE session id |

## API

Uses Carina ACP-IDE endpoints:

- `GET /api/health`
- `GET /acp/ide/capabilities`
- `POST /acp/ide/chat` (SSE streaming)
- `GET /acp/tools`
