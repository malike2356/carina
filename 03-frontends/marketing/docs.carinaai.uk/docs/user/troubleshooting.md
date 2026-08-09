---
sidebar_position: 4
title: Troubleshooting
description: Common errors, fixes, and FAQ for Carina self-hosted and CLI installs.
---

# Troubleshooting and FAQ

This page covers the most common install, memory, gateway, and tool errors for Carina (`npm install -g carina-agent`). Each entry lists the symptom, likely cause, and fix.

## Setup and install problems

### `node: command not found` or wrong Node version

**Symptom:** Install or `carina` fails with `node: command not found`, or Node reports a version below 22.

**Cause:** Carina requires Node.js 22 or higher. An older Node install, or no Node on PATH, blocks the CLI and native addons.

**Fix:** Check your version, then install or switch to Node 22+:

```bash
node --version
```

```bash
# nvm
nvm install 22 && nvm use 22

# fnm
fnm install 22 && fnm use 22
```

Or download Node 22 from [nodejs.org](https://nodejs.org), then re-run:

```bash
npm install -g carina-agent
```

---

### `better-sqlite3` or `node-pty` native build fails on install

**Symptom:** `npm install -g carina-agent` fails during compilation of `better-sqlite3`, `node-pty`, or similar native modules.

**Cause:** These packages compile C++ addons. Your system is missing build tools or development headers.

**Fix:** Install build tools for your OS, then retry the global install:

```bash
# Linux / Debian / Ubuntu
sudo apt-get install -y build-essential python3

# macOS
xcode-select --install

# Windows: install "Desktop development with C++" from Visual Studio Build Tools
npm install -g carina-agent
```

:::note
On ARM Linux (Raspberry Pi, Oracle Ampere) you may also need `libssl-dev` and `libsqlite3-dev`.
:::

---

### `carina: command not found` after global install

**Symptom:** `npm install -g carina-agent` succeeds, but the shell reports `carina: command not found`.

**Cause:** The npm global bin directory is not on your `PATH`.

**Fix:** Find the global bin path and add it to your shell profile:

```bash
npm bin -g
echo 'export PATH="$(npm bin -g):$PATH"' >> ~/.bashrc
source ~/.bashrc
```

On macOS with Homebrew Node, the path is often `/opt/homebrew/bin` or `/usr/local/bin`.

---

### `carina setup` exits immediately with no prompt

**Symptom:** Running `carina setup` returns instantly with no wizard questions.

**Cause:** The setup wizard needs an interactive TTY. CI runners, Docker without `-it`, and piped shells are non-interactive.

**Fix:** Run `carina setup` directly in a normal terminal session. For headless setup, create `~/.carina/.env` manually (copy from `.env.example` in the repo) and set at least one LLM provider key before starting Carina.

---

### `.env` not found / Carina creates a new one every run

**Symptom:** Carina logs that `.env` is missing on every start, or your settings never persist.

**Cause:** Carina reads `~/.carina/.env` by default. If `CARINA_HOME` points to a temporary or read-only directory, a fresh file is created there each run and lost on restart.

**Fix:** Check where Carina is writing config:

```bash
echo $CARINA_HOME
ls -la ~/.carina/.env
```

Unset `CARINA_HOME` if it is wrong, or point it to a persistent path:

```bash
export CARINA_HOME=~/.carina
mkdir -p ~/.carina
carina setup
```

:::tip
The wizard writes `~/.carina/.env` with mode `0600`. Keep API keys out of git.
:::

---

## Memory and database

### Carina logs "Memory store not ready" at startup

**Symptom:** Startup shows `Memory store not ready` or `running in chat-only mode`.

**Cause:** PostgreSQL is unreachable, `DATABASE_URL` is missing or wrong, or Postgres is not running.

**Fix:** This is a warning, not a fatal error; chat and tools still work. To enable memory, start Postgres 16, set `DATABASE_URL` in `~/.carina/.env`, and confirm connectivity:

```bash
# Docker (from core.carinaai.uk directory)
docker compose up -d postgres

# systemd
sudo systemctl start postgresql
```

```bash
psql "$DATABASE_URL" -c "SELECT 1;"
```

Startup should then log `Memory store ready`. See [Running without a database](/docs/user/getting-started#running-without-a-database) for what works without Postgres.

---

### `pgvector` extension not installed

**Symptom:** Postgres errors such as `type "vector" does not exist` when Carina writes or searches embeddings.

**Cause:** The `pgvector` extension is not installed on your Postgres 16 server or not enabled in the `carina` database.

**Fix:** Install pgvector on the server, then enable it in your database:

```bash
# Ubuntu / Debian (Postgres 16)
sudo apt install postgresql-16-pgvector

# macOS with Homebrew
brew install pgvector
```

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Restart Postgres after installing the package, then restart Carina.

---

### `DATABASE_URL` connection refused

**Symptom:** Logs show `ECONNREFUSED` or `connection refused` for Postgres.

**Cause:** Postgres is stopped, listening on a different host or port, or firewall rules block the connection.

**Fix:** Start Postgres and match `DATABASE_URL` to the actual port. The included Docker Compose file maps Postgres to host port **5433**, not the default 5432:

```bash
docker compose up -d postgres
```

```bash
DATABASE_URL=postgresql://carina:secret@localhost:5433/carina
```

Also ensure Redis 7 is running if you use session features that depend on it:

```bash
docker compose up -d redis
```

---

### `/recall` returns empty even after a long conversation

**Symptom:** `/recall` in the CLI shows nothing after several turns.

**Cause:** Memory is written asynchronously; Postgres or embeddings may be misconfigured; or `GEMINI_API_KEY` is missing so writes are skipped.

**Fix:**

1. Confirm `DATABASE_URL` is set and `psql "$DATABASE_URL" -c "SELECT 1;"` succeeds.
2. Set `GEMINI_API_KEY` for `text-embedding-004` embeddings.
3. Confirm `pgvector` is installed (see above).
4. Wait a few seconds after a message; memory is not always instant.

```bash
# After a short chat in the CLI
/recall
```

---

### Embeddings fail with 404 (missing `GEMINI_API_KEY`)

**Symptom:** Logs show embedding API 404, `model not found`, or memory ingest failures.

**Cause:** `GEMINI_API_KEY` is unset or invalid. Carina uses Gemini `text-embedding-004` for memory and RAG. An outdated `carina-agent` build can also hit the wrong API version.

**Fix:** Add a valid key to `~/.carina/.env`:

```bash
GEMINI_API_KEY=your-key-here
```

Get a key from [Google AI Studio](https://aistudio.google.com/apikey). Then update the CLI and restart:

```bash
npm install -g carina-agent@latest
carina --version
```

---

### Running without Postgres at all

**Symptom:** You want to try Carina without installing PostgreSQL.

**Cause:** Postgres is optional. Carina defaults to stateless mode when `DATABASE_URL` is omitted or unreachable.

**Fix:** Omit `DATABASE_URL` from `.env`. Expect the startup warning; everything below still works:

| Feature | Without Postgres |
|---|---|
| Chat (LLM conversation) | Works |
| Web search (Tavily) | Works if `TAVILY_API_KEY` is set |
| Tool execution | Works |
| All gateways (Telegram, WhatsApp, Web, Discord, etc.) | Works |
| Skill packs | Works |
| Episodic memory (`/recall`) | Not available |
| RAG knowledge search | Not available |
| Session persistence across restarts | Not available |

:::tip
Start without a database, use Carina for a day, then add Postgres 16 with pgvector when you want memory and RAG.
:::

---

## Gateways

### Telegram bot not responding

**Symptom:** Messages to your Telegram bot get no reply.

**Cause:** `TELEGRAM_BOT_TOKEN` is missing or invalid; webhook mode is set but the URL is not reachable; or Carina was not restarted after adding the token.

**Fix:**

1. Set `TELEGRAM_BOT_TOKEN` in `~/.carina/.env` (from [@BotFather](https://t.me/BotFather)).
2. Carina uses **long polling** by default. If you set `TELEGRAM_WEBHOOK_URL`, the endpoint must be public HTTPS.
3. Restart Carina after changing env vars.

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getMe"
```

---

### WhatsApp not connecting

**Symptom:** QR code loops, session drops, or WhatsApp never shows as connected.

**Cause:** Baileys needs a one-time QR scan; the session file may be corrupt; or two Carina instances share the same session path.

**Fix:** On first run, scan the terminal QR with WhatsApp on your phone within 60 seconds. The session is saved to `~/.carina/data/whatsapp-session/`.

```bash
# Reset a broken session
rm -rf ~/.carina/data/whatsapp-session/
carina
```

Ensure only one Carina process uses that session directory.

---

### Web UI not opening at `localhost:3000`

**Symptom:** Browser cannot reach `http://localhost:3000`.

**Cause:** `WEB_ENABLED=false` disables the web gateway; port 3000 is in use; or Docker is running without a port mapping.

**Fix:**

```bash
# Check env
grep WEB_ENABLED ~/.carina/.env

# Find what is using the port
lsof -i :3000
```

Set `WEB_ENABLED=true` (or remove the variable). Change the port if needed:

```bash
WEB_PORT=3100
```

In Docker, map the web port in your compose file (for example `3000:3000`).

---

### Discord bot missing permissions

**Symptom:** Bot is online but ignores messages, or logs show missing intent errors.

**Cause:** Discord requires privileged intents and channel permissions for the bot to read and reply to messages.

**Fix:** In the [Discord developer portal](https://discord.com/developers/applications), open your app, then **Bot**, and enable:

- **Message Content Intent** (required)
- **Server Members Intent** (optional; only if Carina needs member data)

Set in `~/.carina/.env`:

```bash
DISCORD_BOT_TOKEN=...
DISCORD_APPLICATION_ID=...
```

Reinvite the bot with `Send Messages`, `Read Message History`, and `Embed Links` if you added intents after the first invite. See [Discord gateway](/docs/user/gateways/discord).

---

## Tools and skills

### `shell-exec` says Docker required

**Symptom:** Shell tool errors with a message that Docker is required.

**Cause:** `shell-exec` runs commands inside a Docker container for isolation. The Docker daemon is not running or not installed.

**Fix:** Start Docker, then retry:

```bash
# Linux
sudo systemctl start docker

# macOS / Windows: start Docker Desktop
docker info
```

:::warning
To run shell commands directly on the host (not recommended for untrusted input), set `CARINA_SHELL_NO_DOCKER=true` in `.env`. Only do this if you fully trust the prompts Carina receives.
:::

---

### Web search returns "Tavily key not configured"

**Symptom:** Web search tool fails with a Tavily configuration error.

**Cause:** `TAVILY_API_KEY` is not set in `~/.carina/.env`.

**Fix:** Create a free key at [app.tavily.com](https://app.tavily.com) (free tier includes roughly 1,000 credits per month), then add:

```bash
TAVILY_API_KEY=tvly-...
```

Restart Carina after saving the file.

---

### Skill pack not activating

**Symptom:** Installed packs do not appear in behaviour or `/skills` output.

**Cause:** `ACTIVE_SKILL_PACKS` is unset, misspelled, or formatted incorrectly.

**Fix:** Set a comma-separated list in `~/.carina/.env` with **no spaces** around commas:

```bash
ACTIVE_SKILL_PACKS=property-uk,finance,core-engineering
```

Install packs first if needed:

```bash
carina pack install property-uk
```

Restart Carina. See [skill packs overview](/docs/user/skill-packs/overview) for pack names.

---

### `carina pack install` fails with hub unreachable

**Symptom:** `carina pack install` errors with hub timeout or unreachable host.

**Cause:** `hub.carinaai.uk` is blocked by network policy, DNS, or is temporarily down.

**Fix:** Check connectivity, then retry:

```bash
curl -I https://hub.carinaai.uk
carina pack install property-uk
```

Install manually from npm if the hub is unavailable:

```bash
npm install -g @verlox/pack-property
```

Set `ACTIVE_SKILL_PACKS=property-uk` and restart Carina.

---

## FAQ

**Q: Does Carina work offline?**

Partially. Agent logic, tools, and skill packs run locally. LLM inference needs a network connection unless you point Carina at a local provider (Ollama, LM Studio). Web search needs the internet and a Tavily key.

**Q: Can I use Carina without any API keys?**

Not in a useful way. You need at least one LLM provider key (DeepSeek is a common free-tier choice at [platform.deepseek.com](https://platform.deepseek.com)). Memory embeddings need `GEMINI_API_KEY`. Everything else is optional.

**Q: What is the difference between `carina-agent`, `@verlox/carina-core`, and Carina Cloud?**

| Thing | What it is |
|---|---|
| `carina-agent` | The npm package you install globally (`npm install -g carina-agent`). Contains the CLI and full agent. |
| `@verlox/carina-core` | The kernel library for developers building on top of Carina. |
| Carina Cloud | Hosted workspace at [app.carinaai.uk](https://app.carinaai.uk) with BYOK keys, billing, and a separate Scout pairing path if you enable it. |

Most users only need `carina-agent`.

**Q: How do I update Carina?**

```bash
npm install -g carina-agent@latest
carina --version
```

**Q: Where are my conversations stored?**

Locally: in PostgreSQL when `DATABASE_URL` is configured, and under `~/.carina/` for config, sessions, and gateway state. Self-hosted data is not sent to VERLOX servers unless you use Carina Cloud.

**Q: Is my data sent to VERLOX?**

No for self-hosted installs. Carina sends prompts to the LLM provider you configure and to tools you invoke (Tavily, Resend, etc.). VERLOX does not receive your conversations or files unless you opt into Carina Cloud or enable the separate Scout product integration.

**Q: Can I use a local LLM (Ollama)?**

Yes. Set your provider to `ollama` or `lmstudio` in `~/.carina/.env` and point `OLLAMA_BASE_URL` or `LM_STUDIO_BASE_URL` at your local server. See [configuration](/docs/user/configuration).

**Q: What does Labyrinth Scout do and is it required?**

Scout is an optional security control plane: prompt injection detection, kill switch, anomaly alerts, and audit trails. Carina works fully without it. See [Labyrinth Scout](/docs/user/security/labyrinth-scout).

---

## White-label and branded deployments

For agencies running Carina under a custom product name or domain, see the dedicated guide: [White-label support and troubleshooting](/docs/user/white-label/support-and-troubleshooting).

Common topics covered there: brand not updating, custom domain TXT verification, pack visibility, scoped Docker ops, and client handoff boundaries.

---

## Related product: Keprix

If the user is on **Keprix** (agent OS at `app.keprixai.com`) rather than this Carina docs site:

- UI tabs or cards that do nothing: hard-refresh; see Keprix guide Troubleshooting → UI navigation.
- Sales Soft Wall / outreach: Keprix `/outreach` and Soft Wall approvals (not Carina OPS).
- Propreneur ↔ Keprix sidecar: Keprix docs under `propreneur-sidecar` and troubleshooting `propreneur-sidecar`.
- Contabo Clinicom AI path is Carina today unless an owner flips the Keprix profile.

---

## Still stuck?

- [GitHub Issues](https://github.com/malike2356/carina-mutant/issues): bug reports and feature requests.
- Email: [support@carinaai.uk](mailto:support@carinaai.uk)
- **Ask Carina directly:** paste your error message into the chat. Carina can often diagnose configuration problems from log output.
