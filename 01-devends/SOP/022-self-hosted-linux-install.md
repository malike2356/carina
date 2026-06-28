# SOP 022: Self-Hosted Linux Install QA
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/carina_self_hosted_linux_install_qa.md
**Last reviewed:** 2026-06-25

---

# Carina self-hosted Linux install: QA reference

**Status:** Ready for self-hosted install. Two paths documented below.

---

## Install readiness summary

| Thing | Status |
|---|---|
| npm package `carina-agent` | Published (check npm for current version) |
| All 5 build phases | Complete |
| Test suite | 5,000+ Vitest tests passing |
| Production deploy | Live on Contabo VPS (carinaai.uk) |
| Docker Compose | Ready (dev + prod variants exist) |
| Node.js requirement | 22+ (hard requirement in package.json) |

---

## Path 1: npm global install (quickest, CLI only)

No PostgreSQL or Redis required for basic CLI use; Carina falls back to SQLite for memory.

```bash
# Step 1: ensure Node.js 22+ is installed
node --version   # must be v22.x or higher

# If not, install via nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22

# Step 2: install Carina globally
npm install -g carina-agent

# Step 3: run it
carina
```

On first run, Carina prompts you to set up your `.env` (API keys). At minimum you need one LLM provider key. DeepSeek is the cheapest option; get a key at platform.deepseek.com.

This gives you: CLI agent, all registered tools, 23 LLM providers, channel adapters.

---

## Path 2: Docker (full stack, recommended for production or integration work)

This runs Carina with PostgreSQL 16 + pgvector + Redis, which is what you want when building on top of Carina (e.g. ABBIS, or any app that needs full memory and RAG support).

```bash
# Step 1: install Docker if not already installed
# Ubuntu/Debian:
sudo apt install docker.io docker-compose-plugin

# Step 2: get the Carina source or the public release
# Option A: use the public release folder
cd /path/to/carina-agent-public

# Option B: use the internal repo
cd /opt/lampp/htdocs/verlox/carina/internal/servers/core.carinaai.uk

# Step 3: copy and fill in the env file
cp .env.example .env
# Edit .env - add at minimum:
#   DEEPSEEK_API_KEY or ANTHROPIC_API_KEY
#   NODE_ENV=development

# Step 4: start the stack
docker compose up -d

# Carina web UI will be running at http://localhost:3333
```

---

## Path 3: Full production stack

For the full Aiva/Carina production stack (all containers), follow `SOP/002-deployment-guide.md`.

---

## Embedding Carina in another application (kernel mode)

When building another application (such as ABBIS) on top of Carina, do not install as a global CLI on the server. Add it as a dependency:

```json
{
  "dependencies": {
    "carina-agent": "^latest"
  }
}
```

Then import and extend it in your Node.js codebase. The Carina engine runs inside your process (as a sidecar or embedded module), sharing the same PostgreSQL instance if you configure it that way.

Carina handles: conversation management, tool calling loop, LLM routing, channel adapters (Telegram, WhatsApp, etc.), memory, and optional Scout security events.

Your application handles: domain-specific tools, knowledge corpus / skill packs, subscription gating, and your own database schema.

**Note on kernel interface:** The engine is production-ready. The clean module split (`@carina/core` vs `@carina/pack-*`) is a future roadmap item. Currently there is one npm package (`carina-agent`) containing everything. This means tight coupling to Carina's internals when embedding. Account for this when planning an upgrade path.

---

## DB migrations

Migrations run inline via `src/memory/migrations.ts` through `runMigrations()` at startup. You do not run SQL migration files directly. The SQL files in `src/infrastructure/migrations/` are documentation only.

---

## What you need at minimum (local dev)

| Requirement | Notes |
|-------------|-------|
| Node.js 22+ | Hard requirement |
| One LLM provider API key | DeepSeek, Anthropic, OpenAI, or any of 23 supported providers |
| Postgres (optional for CLI) | Required for full memory, RAG, multi-tenant; Docker Compose provides it |
| Redis (optional for CLI) | Required for job queues and Scout kill-switch channel; Docker Compose provides it |

---

## Minimum `.env` for local dev

```bash
# Carina core
DATABASE_URL=postgresql://carina:secret@localhost:5432/carina
REDIS_URL=redis://localhost:6379
DEEPSEEK_API_KEY=your-key-here
NODE_ENV=development
```

For the full set of variables, see `.env.example` in the core directory.

---

## Common issues on Linux

| Symptom | Fix |
|---------|-----|
| `node: /lib/x86_64-linux-gnu/libc.so.6: version GLIBC_2.28 not found` | Node.js version too old; upgrade to 22+ via nvm |
| `EACCES: permission denied` on global npm install | Use nvm instead of system Node, or `sudo npm install -g` (not recommended) |
| Postgres connection refused | Start postgres: `docker compose up -d postgres` |
| Port 3333 already in use | Something else is on port 3333; check with `ss -tlnp | grep 3333` |
| `carina` command not found after install | Check that npm global bin is in your PATH: `npm bin -g` |

---

## Updating Carina

```bash
# CLI install
npm install -g carina-agent@latest

# Docker
cd /path/to/core.carinaai.uk
docker compose pull
docker compose up -d
```

---

## Verifying the install

```bash
carina --version
carina doctor
carina chat   # should start a session
```

`carina doctor` checks LLM connectivity, database connection, and optional feature readiness.
