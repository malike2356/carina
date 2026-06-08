# Documentation - Carina + Labyrinth Scout

**Scope:** Full documentation for both products.
**Carina docs location:** `core.carinaai.uk/docs/` (VitePress already installed, `.vitepress/config.ts` exists)
**Scout docs location:** `console.labyrinthscout.com/docs/` (create new VitePress site)

Do NOT create placeholder content. Every page must be complete, accurate, and production-ready.

---

## Part 1: Carina Documentation (VitePress)

The VitePress structure already exists at `core.carinaai.uk/docs/`. Files exist but content is incomplete. Rewrite every file completely.

### `.vitepress/config.ts`

```typescript
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Carina',
  description: 'Autonomous AI agent with skill packs. Free. Open source.',
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'Tools', link: '/tools/overview' },
      { text: 'Skill Packs', link: '/skill-packs/overview' },
      { text: 'Gateways', link: '/gateways/cli' },
      { text: 'GitHub', link: 'https://github.com/verlox/carina' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'What is Carina?', link: '/index' },
          { text: 'Install', link: '/getting-started' },
          { text: 'Configuration', link: '/configuration' },
          { text: 'Self-hosting', link: '/self-hosting' },
        ]
      },
      {
        text: 'Tools',
        items: [
          { text: 'Overview', link: '/tools/overview' },
          { text: 'Web Search', link: '/tools/web-search' },
          { text: 'File', link: '/tools/file' },
          { text: 'Shell', link: '/tools/shell' },
          { text: 'HTTP', link: '/tools/http' },
          { text: 'Email', link: '/tools/email' },
          { text: 'Code Execution', link: '/tools/code' },
        ]
      },
      {
        text: 'Skill Packs',
        items: [
          { text: 'Overview', link: '/skill-packs/overview' },
          { text: 'property-uk', link: '/skill-packs/property-uk' },
          { text: 'Creating Packs', link: '/skill-packs/creating-packs' },
        ]
      },
      {
        text: 'Gateways',
        items: [
          { text: 'CLI', link: '/gateways/cli' },
          { text: 'Telegram', link: '/gateways/telegram' },
          { text: 'WhatsApp', link: '/gateways/whatsapp' },
          { text: 'Web UI', link: '/gateways/web' },
        ]
      },
      {
        text: 'Security',
        items: [
          { text: 'Labyrinth Scout', link: '/security/labyrinth-scout' },
        ]
      }
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/verlox/carina' }
    ],
    footer: {
      message: 'MIT Licensed. Built by VERLOX Ltd.',
      copyright: 'Copyright 2026 VERLOX Ltd'
    }
  }
})
```

---

### `docs/index.md`

```markdown
---
layout: home
hero:
  name: Carina
  text: The autonomous AI agent that gets smarter every session.
  tagline: Free. Open source. UK property knowledge built in. Add Labyrinth Scout for enterprise security.
  image:
    src: /hero-terminal.svg
    alt: Carina terminal
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: GitHub
      link: https://github.com/verlox/carina

features:
  - icon: 🧠
    title: Persistent Memory
    details: Episodic memory with pgvector semantic search. Carina recalls relevant past conversations automatically across sessions.
  - icon: ✨
    title: Self-Writing Skills
    details: After solving a complex problem, Carina writes a Skill document. She gets smarter every session without retraining.
  - icon: 🔧
    title: Real Tool Execution
    details: Web search, files, shell (sandboxed), email, HTTP, code execution. She acts, not advises.
  - icon: 🔄
    title: Switch Providers Mid-Session
    details: DeepSeek, Claude, GPT-4o. Type /provider anthropic. No restart.
  - icon: 📦
    title: Vertical Skill Packs
    details: UK property knowledge built in. 95+ documents, 6 pre-built skills, PropertyData API pre-configured.
  - icon: 🔒
    title: Labyrinth Scout Security
    details: Optional enterprise security control plane. Prompt injection detection, kill switch, real-time monitoring.
---
```

---

### `docs/getting-started.md`

Complete guide covering:

1. **Prerequisites** - Node.js 22+, pnpm, PostgreSQL 16 with pgvector, Redis 7
2. **Install (global)** - `npm install -g carina-agent` then `carina`
3. **Install from source** - clone repo, `cd core.carinaai.uk`, `pnpm install`, `pnpm cli`
4. **First run wizard** - explains the provider selection (DeepSeek recommended), API key entry, skill pack selection
5. **Your first conversation** - example showing a property yield calculation
6. **Environment variables** - table of all vars with descriptions and whether required/optional
7. **Database setup** - how to run PostgreSQL + pgvector via the included docker-compose.yml
8. **Verify memory is working** - how to check episodic memory is storing (`/recall` command)

---

### `docs/configuration.md`

Complete reference for every `.env` variable:

| Variable | Required | Default | Description |
|---|---|---|---|
| `DEFAULT_PROVIDER` | No | `deepseek` | Primary LLM. Options: `deepseek`, `anthropic`, `openai` |
| `DEEPSEEK_API_KEY` | If using DeepSeek | - | Get from platform.deepseek.com |
| `ANTHROPIC_API_KEY` | If using Claude | - | Get from console.anthropic.com |
| `OPENAI_API_KEY` | If using GPT-4o | - | Get from platform.openai.com |
| `GEMINI_API_KEY` | Recommended | - | Used for embeddings (text-embedding-004, 768 dims). Get from aistudio.google.com |
| `DATABASE_URL` | Yes | `postgresql://localhost:5432/carina` | PostgreSQL connection string with pgvector |
| `REDIS_URL` | No | `redis://localhost:6379` | Used for session persistence |
| `BRAVE_SEARCH_API_KEY` | For web-search tool | - | Get from brave.com/search/api |
| `RESEND_API_KEY` | For email tool | - | Get from resend.com |
| `WEB_PORT` | No | `3000` | Port for the web UI gateway |
| `TELEGRAM_BOT_TOKEN` | For Telegram gateway | - | From @BotFather on Telegram |
| `SKILL_AUTO_WRITE` | No | `false` | Auto-generate skill documents after complex tasks |
| `LABYRINTH_ENABLED` | No | `false` | Enable Labyrinth Scout security integration |
| `LABYRINTH_URL` | If Scout enabled | - | Scout server URL, e.g. `http://localhost:4444` |
| `LABYRINTH_API_KEY` | If Scout enabled | - | Must match `SCOUT_API_KEY` in Scout's .env |
| `LABYRINTH_INSTANCE_ID` | If Scout enabled | `carina-local` | Unique name for this Carina instance |

---

### `docs/gateways/cli.md`

Complete CLI reference:

**Starting:**
```bash
pnpm cli          # from source
carina            # global install
```

**Commands (type in conversation):**
| Command | Description |
|---|---|
| `/help` | Show all commands |
| `/provider` | List available providers |
| `/provider deepseek` | Switch to DeepSeek |
| `/provider anthropic` | Switch to Claude |
| `/clear` | Clear session memory |
| `/recall` | Show recent session turns |
| `/recall 20` | Show last 20 turns |
| `/skills` | List all saved skill documents |
| `/memories` | List episodic memories (when Scout enabled) |
| `/memories delete <id>` | Delete a specific memory |
| `exit` | Quit |

**Streaming:** Carina streams token-by-token. Tool calls appear as `[using web-search...]` inline during the response.

---

### `docs/gateways/telegram.md`

Setup:
1. Talk to @BotFather, create a bot, copy the token
2. Add `TELEGRAM_BOT_TOKEN=...` to `.env`
3. Start Carina (`pnpm dev` or `carina`)
4. Find your bot on Telegram and send `/start`

Telegram-specific:
- Responses stream by editing the same message (updates every 1 second)
- Messages longer than 4096 chars split automatically
- Same commands work: `/help`, `/provider deepseek`, `/clear`
- Memory is persistent across Telegram sessions (same session ID per user)

---

### `docs/gateways/whatsapp.md`

Requires Twilio account. Setup:
1. Create Twilio account, get WhatsApp sandbox number
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
3. In Twilio console, set webhook to `https://your-domain/webhooks/whatsapp`
4. WhatsApp doesn't support streaming - full response sent at once
5. Media attachments (images, PDFs) saved locally and available to file tools

---

### `docs/gateways/web.md`

The web UI runs at `http://localhost:3333` (or `WEB_PORT`).

Features:
- SSE streaming (real-time token delivery)
- Provider badge showing active LLM
- Session ID stored in localStorage (persists across page refreshes)
- `/provider`, `/clear`, `/help` work in the input
- Chat history cleared on browser refresh (memory persists in DB)

API endpoints (for integrations):
- `POST /api/chat` - non-streaming, returns full response
- `GET /api/chat/stream?message=...&sessionId=...` - SSE streaming
- `GET /api/providers` - list configured providers
- `POST /api/clear` - clear session memory

---

### `docs/tools/overview.md`

6 tools. All MCP-compatible schemas. Each requires confirmation for destructive operations.

| Tool | Key | Sandboxed | Needs Confirmation |
|---|---|---|---|
| `web-search` | `BRAVE_SEARCH_API_KEY` | N/A | Never |
| `file-read` | None | Path safety only | Never |
| `file-write` | None | System path blocked | If file exists |
| `shell-exec` | None | Docker required | Always (dangerous) |
| `http-request` | None | HTTPS + SSRF rules | Never |
| `email-send` | `RESEND_API_KEY` | N/A | Never |
| `code-exec` | None | Docker (vm fallback) | If uses `import`/`require` |

---

### Individual tool pages (`docs/tools/*.md`)

Each tool page must cover:
- What it does
- Required environment variables
- Security rules enforced
- Example usage (what to type to Carina)
- What Carina returns

Example for `docs/tools/shell.md`:
```markdown
# Shell Execution

Runs a shell command in a sandboxed Docker container with no network access.

## Requirements
- Docker must be installed and running
- Without Docker: shell-exec is disabled entirely (not degraded - hard disabled)

## Security
- Runs in `alpine:latest` container with `--network=none --memory=128m --read-only`
- Dangerous command patterns blocked before Docker is even called:
  - `rm -rf /` and variants
  - Fork bombs
  - Disk destroyers (`dd if=`, `mkfs`)
  - Curl/wget piped to shell
- All executions logged to `data/logs/shell.log`
- Always requires confirmation - Carina will ask before running
- Does not run as root

## Example
> "Run ls -la on the /tmp directory"

Carina will ask: "Run this tool? (y/N): " before executing.
```

---

### `docs/skill-packs/property-uk.md`

Full reference for the built-in UK property pack:

**6 pre-built skills:**
- `brr-analysis` - Buy, Refurbish, Refinance deal analysis
- `hmo-compliance-check` - HMO licensing, room sizes, fire regs
- `yield-calculator` - Gross and net yield from price and rent
- `deal-sourcing-workflow` - On/off-market deal sourcing procedure
- `area-scoring` - Location due diligence framework
- `bridging-finance-explainer` - Bridging loan costs, exit, risks

**95+ knowledge documents** covering: BRR strategy, HMO regulations, SDLT, planning permission, Article 4, bridging finance, land registry, compliance, portfolio management.

**Pre-configured tools:**
- PropertyData API (`PROPERTY_DATA_API_KEY`) - prices, yields, sold comparables by postcode
- Land Registry lookup (`LAND_REGISTRY_API_KEY`)

**How to trigger skills:**
Skills are triggered automatically when Carina detects relevant keywords. You can also trigger directly: "Use the HMO compliance check skill for a 6-bed in Portsmouth."

**Ingesting knowledge:**
```bash
pnpm ingest   # Ingests all docs into pgvector RAG
```
Requires `GEMINI_API_KEY` or `OPENAI_API_KEY` for embeddings.

---

### `docs/security/labyrinth-scout.md`

Brief page explaining Scout integration and linking to Scout's own docs.

- What Scout adds: prompt injection detection, kill switch, real-time monitoring, honeypots, anomaly detection
- How to connect: add 4 env vars, start Scout, start Carina
- 20% discount when used together
- Link to `https://docs.labyrinthscout.com`

---

## Part 2: Labyrinth Scout Documentation (New VitePress Site)

Create a new VitePress site at `console.labyrinthscout.com/docs/`.

```bash
mkdir -p console.labyrinthscout.com/docs/.vitepress
```

Install VitePress as a dev dependency in `console.labyrinthscout.com/package.json` and add scripts:
```json
"docs:dev": "vitepress dev docs",
"docs:build": "vitepress build docs"
```

### Scout docs structure:

```
console.labyrinthscout.com/docs/
├── .vitepress/config.ts
├── index.md                    Landing page
├── getting-started.md          Install + first setup
├── configuration.md            All env vars
├── dashboard.md                Dashboard guide (what each panel shows)
├── integration/
│   ├── carina.md              Native Carina integration
│   ├── openclaw.md            OpenClaw via HTTP proxy
│   ├── hermes.md              Hermes via HTTP proxy
│   ├── custom-agent.md        SDK usage for custom agents
│   └── docker.md              Docker Compose setup
├── security/
│   ├── prompt-guard.md        3-layer injection detection
│   ├── tool-policy.md         Allowlist, blocklist, rate limits
│   ├── egress-filter.md       Domain allowlist + DLP
│   ├── honeypots.md           Deception layer
│   └── anomaly-detection.md   Z-score baseline detection
├── api/
│   ├── events.md              POST /api/events
│   ├── heartbeat.md           POST /api/heartbeat
│   ├── status.md              GET /api/status
│   ├── kill-switch.md         POST /api/kill/:id + /api/resume/:id
│   ├── honeypots.md           Honeypot management endpoints
│   └── stream.md              SSE /api/stream
├── sdk/
│   ├── node.md                @verlox/labyrinth-scout npm package
│   └── python.md              labyrinth-scout PyPI package
└── pricing.md                 Pricing and Carina discount
```

---

### Key Scout doc pages to write fully:

**`docs/getting-started.md`:**
1. Prerequisites (Node 22, Postgres with pgvector, Redis)
2. Install: `docker run -d verlox/scout:latest` OR from source: `cd console.labyrinthscout.com && pnpm install && pnpm dev`
3. Required env vars: `SCOUT_API_KEY`, `SCOUT_DATABASE_URL`, `REDIS_URL`
4. Connect first agent (Carina): 4 env vars to add
5. Verify: open dashboard at `http://localhost:4444`, send a heartbeat

**`docs/dashboard.md`:**
- Radar scanner: what it shows, how threat dots work, colour coding
- Event frequency graph: 60-second rolling window, bar height = severity-weighted count
- Anomaly score chart: Z-score timeline, threshold at 3.0
- Tool heatmap: usage intensity by tool and hour
- Live event stream: severity badges, filtering
- Kill switch: how to use, confirmation required
- Instance bar: heartbeat recency, active vs suspended vs offline

**`docs/integration/carina.md`:**
```bash
# Add to Carina's .env
LABYRINTH_ENABLED=true
LABYRINTH_URL=http://localhost:4444
LABYRINTH_API_KEY=your_scout_key
LABYRINTH_INSTANCE_ID=carina-prod
```
Carina automatically:
- Sends heartbeat every 60 seconds
- Reports every tool call with duration and params
- Reports prompt injection detections
- Listens for kill switch via Redis pub/sub

**`docs/api/events.md`:**
Full request/response documentation:
```
POST /api/events
Header: X-Scout-Key: <key>
Body: {
  severity: "info" | "warning" | "critical" | "breach",
  source: string,
  event_type: string,
  description: string,
  instance_id: string,
  session_id?: string,
  metadata?: object
}
Response: { ok: true, id: "uuid" }
```

**`docs/sdk/node.md`:**
Complete usage guide with all methods, error handling, TypeScript types.

**`docs/pricing.md`:**
```markdown
# Pricing

## Self-Hosted (Free)
Run Scout yourself. MIT licensed. No limits.

```bash
docker run -d \
  -e SCOUT_API_KEY=your_key \
  -e SCOUT_DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  verlox/scout:latest
```

## Standard - £99/month
Hosted by VERLOX. Unlimited agents. 99.9% uptime.

## Carina Bundle - £79/month (20% off)
Use Scout with Carina (the free, open-source agent) and save £240/year.
The discount is applied at checkout with a promo code generated during `carina setup`.

## Enterprise - Custom
SOC2 Type II, SLA, dedicated Slack support, on-premise option.
Contact sales@labyrinthscout.com
```

---

## Writing style for all documentation

- Direct. No filler. Every sentence earns its place.
- Code examples for everything that has a command.
- No placeholder content. No "Coming soon." No "TODO:".
- Assume the reader is a developer. Skip the basics. Explain the non-obvious.
- No em dashes. No exclamation marks.
- Tables for configuration references.
- Warnings (`:::warning`) for security-relevant config (never commit API keys, etc.)
