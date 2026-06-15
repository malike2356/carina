---
sidebar_position: 5
title: Troubleshooting
description: Common errors, fixes, and FAQ for Carina self-hosted and CLI installs.
---

# Troubleshooting

Common errors and their fixes. If nothing here resolves your issue, open a [GitHub Issue](https://github.com/malike2356/carina-agent/issues) or email support@carinaai.uk.

---

## Setup and install

### `node: command not found` or wrong Node version

Carina requires Node.js 22 or higher. Check your version:

```bash
node --version
```

If it prints below `v22.0.0` or the command is not found, install Node 22 from [nodejs.org](https://nodejs.org) or via a version manager:

```bash
# nvm
nvm install 22 && nvm use 22

# fnm
fnm install 22 && fnm use 22
```

---

### Native build fails on install (`better-sqlite3`, `node-pty`, `bcrypt`)

These packages compile native addons. The install needs build tools:

**Linux / Debian / Ubuntu:**
```bash
sudo apt-get install -y build-essential python3
```

**macOS:**
```bash
xcode-select --install
```

**Windows:** install the "Desktop development with C++" workload from Visual Studio Build Tools, then re-run:

```bash
npm install -g carina-agent
```

:::note
On ARM Linux (Raspberry Pi, Oracle Ampere) you may also need `libssl-dev` and `libsqlite3-dev`.
:::

---

### `carina: command not found` after global install

The npm global bin directory is not on your PATH. Find where it is:

```bash
npm bin -g
```

Add that path to your shell profile (`~/.bashrc`, `~/.zshrc`, or equivalent), then reload:

```bash
echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
source ~/.bashrc
```

---

### `carina setup` exits immediately with no prompt

You are running in a non-interactive terminal (CI, Docker without a TTY, or piped input). The wizard requires a TTY. Run it directly in your shell:

```bash
carina setup
```

To set up non-interactively, create `~/.carina/.env` by hand before running `carina`. Copy `.env.example` from the repo as a template and fill in at minimum one provider key.

---

### Carina creates a new `.env` every run / config is not saved

Carina writes to `~/.carina/.env` by default. If `CARINA_HOME` is set to a read-only or temporary path, the file is created there and lost on restart. Check:

```bash
echo $CARINA_HOME
```

Unset it if it points somewhere unexpected, or point it to a persistent directory:

```bash
export CARINA_HOME=~/.carina
```

---

## Memory and database

### `Memory store not ready` at startup

This message means Carina cannot reach PostgreSQL. It is a warning, not a fatal error. Carina continues in chat-only mode. See [Running without a database](/docs/user/getting-started#running-without-a-database) for what still works.

To fix it, ensure Postgres is running and `DATABASE_URL` is set correctly in `~/.carina/.env`:

```
DATABASE_URL=postgresql://carina:yourpassword@localhost:5432/carina
```

Test the connection:
```bash
psql $DATABASE_URL -c "SELECT 1;"
```

---

### `pgvector` extension not installed

Carina uses `pgvector` for embedding search. If you see an error like `type "vector" does not exist`, install the extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Run that inside your `carina` database. If pgvector is not installed on your Postgres server, install it first:

```bash
# Ubuntu / Debian (Postgres 16)
sudo apt install postgresql-16-pgvector

# macOS with Homebrew
brew install pgvector
```

Then restart Postgres and re-run the `CREATE EXTENSION` command.

---

### `DATABASE_URL` connection refused

Postgres is not running, or is on a different port. Start it:

```bash
# Docker (from core.carinaai.uk directory)
docker compose up -d postgres

# systemd
sudo systemctl start postgresql
```

The Docker compose file maps Postgres to host port **5433**, not the default 5432. Check your `DATABASE_URL` matches.

---

### `/recall` returns empty after a long conversation

Memory is written asynchronously. It can take a few seconds to appear after a message. Also confirm that:

1. `DATABASE_URL` is set and Postgres is reachable.
2. `GEMINI_API_KEY` is set. Carina uses Gemini `text-embedding-004` to embed memories. Without it, memory writes are skipped.
3. The pgvector extension is installed (see above).

---

### Embeddings fail with 404 or `model not found`

This is the Gemini API version mismatch. Ensure you are on `carina-agent` v0.2.0 or later, which pins the embedding call to the correct API version. Update:

```bash
npm install -g carina-agent@latest
```

---

### Running without Postgres: what still works

See [Running without a database](/docs/user/getting-started#running-without-a-database) for the full table. Short answer: chat, tools, web search, skills, and all gateways work. Memory, `/recall`, and RAG do not.

---

## Gateways

### Telegram bot not responding

1. Check `TELEGRAM_BOT_TOKEN` is set in `~/.carina/.env`.
2. A token looks like `8909767956:AAHBoWW6wAxQ1xRW...`. Get one from [@BotFather](https://t.me/BotFather).
3. Carina uses long-polling by default. If you set `TELEGRAM_WEBHOOK_URL`, the webhook URL must be publicly reachable over HTTPS.
4. Restart Carina after adding the token.

```bash
# Test that the token is valid
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

---

### WhatsApp not connecting (QR scan loop)

Carina uses [Baileys](https://github.com/WhiskeySockets/Baileys) for WhatsApp. On first run it shows a QR code in the terminal; scan it with your phone within 60 seconds. The session is then saved to `~/.carina/data/whatsapp-session/`.

If the QR keeps regenerating:
- Delete `~/.carina/data/whatsapp-session/` and scan again.
- Ensure only one Carina instance is running (two instances sharing the same session file conflict).

---

### Web UI not opening at `localhost:3000`

1. Check `WEB_ENABLED` is not set to `false` in your `.env`.
2. Port 3000 may be in use. Change it: `WEB_PORT=3100`.
3. If running inside Docker without port mapping, map the port in your compose file.

```bash
# Check what is using port 3000
lsof -i :3000
```

---

### Discord bot missing events or messages

The Discord gateway requires the **Message Content** privileged intent enabled in the Discord developer portal. Go to your application, then Bot, then enable "Message Content Intent". Reinvite the bot if you added the intent after the initial invite.

---

## Tools and skills

### `shell-exec` says Docker required

The shell execution tool runs commands inside a Docker container for safety. If Docker is not running:

```bash
# Start Docker daemon (Linux)
sudo systemctl start docker

# Or use Docker Desktop on macOS / Windows
```

If you deliberately want to skip Docker isolation (not recommended for production), set:
```
CARINA_SHELL_NO_DOCKER=true
```

:::warning
Without Docker, `shell-exec` runs directly on your host system. Only enable this if you trust the inputs Carina will receive.
:::

---

### Web search returns "Tavily key not configured"

Get a free Tavily API key at [app.tavily.com](https://app.tavily.com) (free tier: ~1,000 credits per month), then add it to `~/.carina/.env`:

```
TAVILY_API_KEY=tvly-...
```

Restart Carina after adding the key.

---

### Skill pack not activating

Set `ACTIVE_SKILL_PACKS` in `~/.carina/.env` as a comma-separated list (no spaces around commas):

```
ACTIVE_SKILL_PACKS=property-uk,finance
```

Available pack names: `property-uk`, `healthcare`, `finance`, `legal-uk`, `devops`, and more. See [skill packs overview](/docs/user/skill-packs/overview).

---

### `carina pack install` fails / hub unreachable

The Skills Hub at `hub.carinaai.uk` must be reachable. Check your network, then retry. If the hub is temporarily down, you can install packs manually from npm:

```bash
npm install @verlox/pack-property
```

Then set `ACTIVE_SKILL_PACKS=property-uk` and restart.

---

## FAQ

**Does Carina work offline?**
Partially. The agent logic, tools, and skill packs work offline. LLM inference requires an internet connection unless you configure a local provider (Ollama, LM Studio). Web search requires the internet.

---

**Can I use Carina without any API keys at all?**
Not meaningfully. You need at least one LLM provider key (DeepSeek is recommended: free tier at [platform.deepseek.com](https://platform.deepseek.com)). Everything else is optional.

---

**What is the difference between `carina-agent`, `@verlox/carina-core`, and Carina Cloud?**

| Thing | What it is |
|---|---|
| `carina-agent` | The npm package you install globally. Contains the CLI and agent. |
| `@verlox/carina-core` | The kernel package used by developers building on top of Carina. |
| Carina Cloud | Hosted version at `app.carinaai.uk` with BYOK keys, billing, and Scout. |

Most users only need `carina-agent`.

---

**How do I update Carina?**

```bash
npm install -g carina-agent@latest
carina --version
```

---

**Where are my conversations stored?**
Locally in your PostgreSQL database (if configured) and in `~/.carina/`. Nothing is sent to VERLOX servers unless you are using Carina Cloud.

---

**Is my data sent to VERLOX?**
No. Self-hosted Carina sends data only to the LLM provider you configure (DeepSeek, Anthropic, OpenAI, etc.) and to any tools you invoke (Tavily for search, Resend for email). VERLOX never receives your conversations or files.

---

**Can I use a local LLM (Ollama, LM Studio)?**
Yes. Set your provider to `ollama` or `lmstudio` in `~/.carina/.env` and point `OLLAMA_BASE_URL` or `LM_STUDIO_BASE_URL` at your local server. See [configuration](/docs/user/configuration) for the full env var list.

---

**What does Labyrinth Scout do and is it required?**
Scout is an optional security control plane for production deployments. It adds prompt injection detection, kill switch, anomaly alerts, and audit trails. It is not required; Carina works fully without it. See [Labyrinth Scout](/docs/user/security/labyrinth-scout).

---

## Still stuck?

- [GitHub Issues](https://github.com/malike2356/carina-agent/issues): bug reports and feature requests.
- Email: support@carinaai.uk
- Ask Carina directly: paste your error message into the chat. Carina can often diagnose configuration issues from error output.
