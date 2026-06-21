# Carina + Labyrinth Scout; Product Bible

**Version:** 1.0  
**Last updated:** 13 June 2026  
**Status:** Live on Base Sepolia (ERC-8004 agent #6981, ERC-8126 verification active)  
**Live at:** core.carinaai.uk | console.labyrinthscout.com | ops.carinaai.uk  
**Trust dashboard:** carinaai.uk/trust  

This document is the definitive reference for the Carina standalone agent and Labyrinth Scout security platform. Nothing is skipped. Every feature, every architectural decision, every integration point, every current gap is documented here.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Architecture](#2-architecture)
3. [The Agent Engine](#3-the-agent-engine)
4. [Labyrinth Scout; Security Engine](#4-labyrinth-scout--security-engine)
5. [Trust Layer; Blockchain Verification](#5-trust-layer--blockchain-verification)
6. [Multi-Tenancy & SaaS (4AS)](#6-multi-tenancy--saas-4as)
7. [Deployment & Operations](#7-deployment--operations)
8. [Domain Packs & Extensibility](#8-domain-packs--extensibility)
9. [Competitive Positioning](#9-competitive-positioning)
10. [Roadmap & Current Status](#10-roadmap--current-status)
11. [Pricing & Business Model](#11-pricing--business-model)
12. [AI Governance & Regulatory Compliance](#12-ai-governance--regulatory-compliance)
13. [What Is NOT Yet Built](#13-what-is-not-yet-built)
14. [Glossary](#14-glossary)

---

## 1. Product Overview

### 1.1 What Carina Is

Carina is an **autonomous AI agent platform** with an integrated **security monitor (Labyrinth Scout)** and a **verifiable trust layer on blockchain**. It is the only agent platform that combines:

1. **General-purpose autonomy**; 71 tools, 96 curated skills, 18 channel adapters, full terminal access, browser automation, parallel subagents, cron scheduling
2. **Domain depth**; 18 optional vertical domain packs (property-UK, healthcare, finance, legal-UK, etc.) with industry-specific tools, data, and models
3. **Security from day one**; Labyrinth Scout provides prompt injection shielding, deception layer (honeypots), anomaly detection, kill switch, egress filtering, and forensic audit logging
4. **Verifiable trust**; ERC-8004 agent identity + ERC-8126 security verification anchored on Base blockchain, with a public trust API and dashboard
5. **Open source (MIT)**; installable via `npm install -g carina-agent`, Docker support, full source available
6. **Self-improving**; writes its own skills, learns from experience, auto-curates its skill library
7. **Channel-agnostic**; Telegram, Discord, Slack, WhatsApp, Signal, SMS, Email, Matrix, Mattermost, iMessage, WeChat, DingTalk, Feishu, Home Assistant, Web, API, Webhook
8. **Production-ready**; background processes, process notifications, cron scheduling with chaining, webhooks, parallel subagents

### 1.2 What Labyrinth Scout Is

Labyrinth Scout is the **security and trust verification layer** for autonomous AI agents. It is:

- A **SIEM for AI agents**; real-time monitoring, threat detection, incident classification
- A **trust oracle**; security attestations anchored on blockchain, verifiable by any third party
- A **governance infrastructure**; compliance exports (SOC2, ISO27001, EU AI Act), audit logs, incident timelines
- A **commercial security product**; £79-99/mo subscription, enterprise tiers, multi-channel alerting

### 1.3 The Three-Layer Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: TRUST (Blockchain)                                │
│  └─ ERC-8004 identity, ERC-8126 verification, on-chain      │
│     attestations, public trust API, verifiable proof         │
│                          ▲                                   │
│  LAYER 2: SECURITY (Labyrinth Scout)                        │
│  └─ Prompt injection shield, deception layer, anomaly       │
│     detection, kill switch, audit logging, DLP, compliance  │
│                          ▲                                   │
│  LAYER 1: AGENT (Carina)                                    │
│  └─ 71 tools, 96 skills, 18 channels, multi-model routing,  │
│     workspaces, domain packs, memory, cron, subagents       │
└─────────────────────────────────────────────────────────────┘
```

This three-layer design means Carina's security posture is **monitored, auditable, and verifiable by third parties**; not claimed, but proven.

### 1.4 The Brand Architecture

| Name | Role | URL |
|------|------|-----|
| **Carina** | Autonomous agent platform | core.carinaai.uk (agent), carinaai.uk (marketing) |
| **Labyrinth Scout** | Security + trust verification | console.labyrinthscout.com (console), labyrinthscout.com (marketing) |
| **Carina Ops** | Operations dashboard | ops.carinaai.uk |
| **Carina Agent (npm)** | CLI package | `npm install -g carina-agent` |

Carina and Scout are **one product with one codebase** (the `carina-ai` monorepo). Scout is the security layer of Carina, not a separate company.

---

## 2. Architecture

### 2.1 Repository Structure

```
carina-ai/                          # Monorepo (Node/TypeScript)
├── core.carinaai.uk/               # Agent engine
│   ├── src/
│   │   ├── agents/                 # Agent types (carina, coding, communication,
│   │   │                           #   file, research, orchestrator, sub-agent)
│   │   ├── tools/                  # 71 tool implementations
│   │   ├── gateway/                # Web gateway + channel adapters (18 platforms)
│   │   ├── memory/                 # 5 backends (builtin, honcho, mem0, postgres, sqlite)
│   │   ├── skills/                 # Skill system (auto-writer, curator, hub, loader, packs)
│   │   ├── brain/                  # LLM routing, provider registry (23 providers),
│   │   │                           #   credential pool, cost tracker, prompt cache
│   │   ├── security/               # Prompt guard, scout client, egress filter,
│   │   │                           #   honeypots, kill switch, JIT credentials
│   │   ├── billing/                # Stripe subscriptions, invoices, usage meter, plans
│   │   ├── mcp/                    # MCP client (HTTP + stdio)
│   │   ├── profiles/               # Profile manager, personality, contacts
│   │   ├── workspaces/             # Agent registry, routing, context, bootstrap
│   │   ├── commitments/            # Commitment extraction, inference, delivery
│   │   ├── sync/                   # Agent-to-agent sync
│   │   ├── credentials/            # OAuth device flow, pool manager
│   │   ├── notifications/          # Expo push, mobile push, Scout poller
│   │   └── ops/                    # Backup/restore, DNS helpers, sandbox, audit
│   └── public/                     # Static assets, dashboard HTML
│
├── console.labyrinthscout.com/     # Scout security console
│   ├── src/
│   │   ├── alerts/                 # 6-channel alert dispatcher
│   │   ├── trust/                  # ERC-8004 identity + ERC-8126 verification
│   │   ├── security/               # Anomaly detector, egress filter, prompt guard,
│   │   │                           #   honeypots, token bucket, tool policy/tiers
│   │   ├── deception/              # Decoy generator, moving target rotation,
│   │   │                           #   stale marker detection
│   │   ├── killswitch/             # Global kill switch, graceful shutdown, audit
│   │   ├── audit/                  # Logger, retention, search, GDPR compliance
│   │   ├── integration/            # Adapters: Carina, Hermes, OpenClaw,
│   │   │                           #   LangChain, OpenAI, generic
│   │   └── proxy/                  # OpenAI proxy
│   └── sdk/node/                   # Node.js client SDK
│
├── ops.carinaai.uk/                # Operations dashboard
├── carinaai.uk/                    # Static marketing site
├── labyrinthscout.com/             # Static marketing site
└── instructions/                   # Internal documentation
    ├── strategy/                   # Vision, positioning
    ├── security/                   # Security docs
    ├── trust/                      # Trust framework
    ├── build-plan/                 # Roadmap, targets, comparisons
    ├── action-prompts/             # Build instructions (phases 1-5)
    ├── operations/                 # Maintenance, troubleshooting
    ├── outreach/                   # External-facing templates
    └── gap-analysis/              # Gap analysis
```

### 2.2 Production Deployment

```
Contabo VPS (80.190.81.208)
├── /home/malike/apps/
│   ├── core.carinaai.uk/dist/      # Port 3333; Agent engine (supervisor: carina-core)
│   ├── console.labyrinthscout.com/dist/  # Port 4444; Scout console (supervisor: labyrinth-scout)
│   └── ops.carinaai.uk/dist/       # Port 4002; Operations dashboard (supervisor: carina-ops)
│
├── /www/wwwroot/
│   ├── carinaai.uk/                # Static marketing + /trust page
│   ├── labyrinthscout.com/         # Static marketing + waitlist
│   └── propreneur-v2/              # Propreneur Laravel (separate product)
│
└── Supervisor services:
    carina-core; Express, port 3333
    labyrinth-scout; Express, port 4444
    carina-ops; Express, port 4002
```

### 2.3 Two Deployment Modes

The same codebase supports two deployment modes without forking:

| | Self-Hosted (CLI) | Cloud (SaaS) |
|---|---|---|
| **User** | Developer, power user | Property investor, business owner |
| **Install** | `npm install -g carina-agent` | Sign up at carinaai.uk |
| **Config** | Local config file, user API keys | Managed Postgres, hosted models |
| **Pricing** | Free (MIT), bring your own keys | Free tier + paid plans |
| **Revenue** | $0 (open-source funnel) | Monthly subscriptions |
| **Database** | Local SQLite/Redis | Managed Postgres + Redis |
| **Models** | Your API keys | Our API keys (or BYOK) |

---

## 3. The Agent Engine

### 3.1 Tool Inventory (71 tools)

#### Core Tools
`web_search`, `file_read`, `file_write`, `patch`, `search_files`, `shell_exec`, `process`, `http`, `code_exec`, `sandbox`, `clarify`, `todo`, `memory`, `session_search`, `send_message`, `cronjob`, `delegate_task`, `webhook`, `agent_sync`

#### Browser Automation (9 tools)
`browser_navigate`, `browser_click`, `browser_type`, `browser_snapshot`, `browser_scroll`, `browser_back`, `browser_console`, `browser_get_images`, `browser_press`

#### Media (6 tools)
`vision_analyze`, `video_analyze`, `video_generation`, `image_generation`, `text_to_speech`, `transcription`

#### Skills (4 tools)
`skills_list`, `skill_view`, `skill_manage`, `skill_curator_tool`

#### Platform Integrations
`discord`, `discord_admin`, `spotify` (search, now_playing, play), `homeassistant` (4 tools), `feishu` (3 tools), `yuanbao` (3 tools), `x_search`, `x_post`, `email_send`, `email_list`

#### Kanban (7 tools)
`kanban_show`, `kanban_complete`, `kanban_block`, `kanban_heartbeat`, `kanban_comment`, `kanban_create`, `kanban_link`

#### Advanced
`mcp`, `lsp`, `computer_use`, `mixture_of_agents`, `checkpoint_manager`, `debug_helpers`, `domain_lookup`, `contacts`

### 3.2 Channel Adapters (18 platforms)

Telegram, Discord, Slack, WhatsApp (Baileys), Signal, SMS, Email, Matrix, Mattermost, iMessage (BlueBubbles), WeChat, DingTalk, Feishu, Home Assistant, Web, API Server, Webhook

Each adapter handles platform-specific formatting, rate limits, and delivery semantics. The agent is channel-agnostic; the same session can span multiple platforms with cross-platform session unification (`CARINA_OPERATOR_SESSION`).

### 3.3 Memory System

**5 backends:**
- `builtin`; In-process, fast, no external dependency
- `honcho`; External memory service with embeddings
- `mem0`; Cloud memory with semantic search
- `postgres`; Production-grade with pgvector for RAG
- `sqlite`; Local, portable, FTS5 full-text search

**Memory architecture:**
- **Session memory**; FTS5-backed full-text search across all past conversations (`session_search`)
- **Persistent memory**; Durable facts injected into every turn (`memory` tool)
- **Long-term memory**; `MEMORY.md` curated file + REM scoring for promotion
- **Daily journaling**; `memory/YYYY-MM-DD.md` raw logs, reviewed during heartbeats
- **Memory consolidation**; Auto-compress old entries, merge related facts, enforce size limits

### 3.4 Skill System

**96 curated skills across 16 packs:**

| Pack | Skills | Description |
|------|--------|-------------|
| autonomous-ai-agents | 6 | Claude Code, Codex, OpenCode, Hermes agent delegation |
| creative | 20 | ASCII art, diagrams, infographics, pixel art, music, video, p5.js, Manim, ComfyUI |
| data-science | 1 | Jupyter live kernel |
| devops | 14 | Kanban orchestration, server troubleshooting, disk management, backup migration |
| email | 1 | Himalaya CLI IMAP/SMTP |
| gaming | 2 | Minecraft servers, Pokemon emulator |
| github | 6 | PRs, code review, issues, repo management |
| media | 5 | YouTube, GIF search, Spotify, audio analysis |
| mlops | 9 | HuggingFace, vLLM, llama.cpp, SAM, evaluation, W&B |
| note-taking | 1 | Obsidian vault integration |
| productivity | 17 | Airtable, Google Workspace, Linear, Notion, PowerPoint, maps |
| propreneur | 1 | Property platform development |
| red-teaming | 1 | LLM jailbreak techniques |
| research | 8 | arXiv, blog monitoring, Polymarket, data forensics |
| smart-home | 1 | Philips Hue |
| social-media | 1 | X/Twitter via xurl CLI |
| software-development | 17 | TDD, debugging, code review, plan writing, subagent development |

**Skill capabilities:**
- **Auto-writer**; Agent creates new skills from successful task patterns
- **Curator**; Merges, deprecates, and maintains skill quality
- **Hub**; Shareable skill packs with versioning
- **Domain packs**; Vertical-specific skill bundles (see Section 8)

### 3.5 Brain; Model Routing

**23 LLM providers** registered in `PROVIDER_DEFINITIONS`: DeepSeek, Anthropic (Claude), OpenAI, OpenRouter, Ollama, LM Studio, NVIDIA, Google, Mistral, xAI, and more.

**Routing features:**
- **Per-task classification**; simple queries route to local/fast models, complex reasoning to cloud/capable models
- **Cost-aware routing**; cheapest model that meets accuracy threshold
- **Provider switching**; mid-conversation model changes, fallback chains
- **BYOK (Bring Your Own Key)**; Tenants provide their own API keys, AES-256-CBC encrypted at rest
- **Cost tracking**; per-model, per-task, per-tenant usage reporting
- **Prompt caching**; reduces repeat costs

### 3.6 Workspaces

Carina supports named agent workspaces with:

- **AGENTS.md**; Auto-loaded system context on session start
- **SOUL.md**; Agent personality and tonal definition
- **IDENTITY.md**; Agent identity and role
- **USER.md**; User preferences and profile
- **TOOLS.md**; Tool-specific configuration
- **BOOTSTRAP.md**; First-run self-configuration (auto-deletes after bootstrap)
- **Daily memory files**; `memory/YYYY-MM-DD.md` raw session logs
- **MEMORY.md**; Curated long-term distilled learnings

### 3.7 Heartbeat System

Periodic proactive checks (~every 30 minutes, skips during quiet hours 23:00-08:00 unless urgent):

- Email inbox (unread messages)
- Calendar (upcoming events in 24-48h)
- Social mentions (X/Twitter)
- Weather (if relevant)
- Memory maintenance (review daily files, update MEMORY.md)

### 3.8 Cron & Scheduling

- **Cron syntax scheduling**; standard cron expressions
- **Job chaining**; `context_from` injects upstream job output into downstream job
- **Multi-channel delivery**; Telegram, Discord, email, SMS, or all
- **Background scripts**; Python + bash, with or without LLM agent
- **Per-job model override**; pin specific model/provider per job
- **Toolset restriction**; limit tools per job for cost/security

### 3.9 Subagents

`delegate_task` spawns up to 3 parallel subagents, each with:
- Isolated terminal session
- Configurable toolsets
- Independent context window
- Results collected and summarized

---

## 4. Labyrinth Scout; Security Engine

### 4.1 Security Posture Overview

Scout provides **defence-in-depth** for autonomous AI agents. Five layers:

| Layer | Technique | Status |
|-------|-----------|--------|
| 1 | Pre-execution input filter (Agent Guard + PromptGuard) | LIVE |
| 2 | Behavioural sequence detection (tool-sequence-guard) | LIVE |
| 3 | Zero standing privileges (JIT credentials) | LIVE |
| 4 | Labyrinth Scout Type 3 detection (reasoning compromise) | LIVE |
| 5 | Forensic artifact capture before containment | LIVE |

### 4.2 Prompt Injection Shield

Three-layer detection:
1. **Regex patterns**; known injection signatures, fast pre-filter
2. **LLM judge**; secondary model evaluates suspicious inputs
3. **Tool result scanning**; checks tool outputs for exfiltration patterns

Blocks are reported to Scout with full context. Repeated blocks escalate severity.

### 4.3 Deception Layer

- **Honeypots**; fake credentials, API keys, and data planted in agent context. Any access triggers immediate alert.
- **Moving target deception**; randomized system prompt markers that rotate. If markers appear in tool output, data exfiltration is confirmed.
- **Stale marker detection**; old markers appearing in new contexts indicates replay or compromise.

### 4.4 Anomaly Detection

Scout monitors agent behaviour for:
- Unusual tool usage patterns (tool X never used before, now used 50x)
- Token consumption spikes
- Session duration anomalies
- Off-hours activity
- Geographic/IP anomalies
- Repeated guard hits

### 4.5 Kill Switch

- **Global kill switch**; emergency stop all agent processes
- **Per-instance suspend**; isolate one compromised agent without affecting others
- **Per-tool quarantine**; block specific tools while keeping agent alive
- **Graceful shutdown**; completes in-flight operations, logs state, closes connections
- **Forensic snapshot**; captures full agent state before containment for post-incident analysis

### 4.6 Audit Logging

- Every tool call logged: timestamp, user, session, parameters, result
- Every model request logged: prompt tokens, completion tokens, model, latency
- Immutable audit trail; cannot be deleted or modified by the agent
- Configurable retention policies
- Searchable via Scout API
- GDPR-compliant: data access requests, deletion, export

### 4.7 Egress Filtering (DLP)

Before any data leaves the agent:
- Allowlist-based outbound URL enforcement
- Sensitive data pattern scanning (credit cards, API keys, PII)
- Tool-specific egress rules
- Block + alert on violation

### 4.8 Alerting System

**6 channels:** Discord, Email, Slack, SMS, Telegram, WhatsApp

**Alert types:**
- `breach`; honeypot trigger, stale marker replay, confirmed credential leak
- `critical`; kill switch fired, trust attestation failure, repeated injection escalation
- `warning`; risk score spike, single injection block, egress block
- `info`; heartbeat gaps, routine shield blocks

**Escalation:** Unacknowledged `breach` or `critical` events trigger secondary operator notification per SLA.

### 4.9 Agent Integration Adapters

Scout works with any agent platform via adapters:
- **Carina**; Native integration (same codebase)
- **Hermes**; Event ingestion adapter
- **OpenClaw**; Event ingestion adapter
- **LangChain**; Middleware adapter
- **OpenAI**; Proxy adapter
- **Generic**; REST API adapter for any agent

### 4.10 OpenAI Proxy

Scout operates a transparent OpenAI-compatible proxy. Agents configured to use the proxy get:
- Automatic prompt injection scanning
- Request/response logging
- Rate limiting
- Cost tracking
- No agent code changes required

### 4.11 Incident Response SLA

| Severity | First human review | Containment decision | Post-incident notes |
|----------|-------------------|---------------------|---------------------|
| `breach` | 15 minutes | 30 minutes | Within 24 hours |
| `critical` | 30 minutes | 1 hour | Within 24 hours |
| `warning` | 4 hours | Next business day | Within 72 hours |
| `info` | 24 hours | Not required | Weekly summary |

---

## 5. Trust Layer; Blockchain Verification

### 5.1 Trust Philosophy

Trust is not claimed; it is proven. Scout's security findings are anchored on blockchain so any third party can verify Carina's security posture without trusting us.

**Strategy decision:** Adopt existing trust infrastructure (Agent Trust on Base, ERC-8004, ERC-8126) rather than building a custom trust platform. Labyrinth Scout's unique contribution is as a **security attestation oracle**; no other trust platform has a real-time SIEM feeding verified security data into attestations.

### 5.2 ERC-8004 Agent Identity

Every Carina instance can register a verifiable on-chain identity:

- **Identity Registry**; Unique on-chain ID per agent instance
- **Reputation Registry**; Structured feedback (human or machine)
- **Validation Registry**; Independent verification of agent's work

**Current state:** Carina reference agent registered on Base Sepolia. Agent ID: `6981`, slug: `carina-reference`. Live in public trust API `identity` block with explorer link.

### 5.3 ERC-8126 Security Verification

Security scores computed and anchored on-chain:

- **WAV (Weighted Attestation Verification)**; Risk score from Scout endpoint health + vulnerability scan findings
- **WV (Wallet Verification)**; Risk score from attestation wallet on-chain history
- **Unified risk score**; Mean of applicable verification scores (0-100, lower is better)

**Current state:** Live on Base Sepolia. Verification request/response transactions visible in public trust API `verification.on_chain` block. `chain.erc8126_status: live`.

### 5.4 Labyrinth Scout Attestations

Custom namespace `labyrinth-scout.v1` registered with Agent Trust:

**Attestation fields:**
- `securityScore` (0-100)
- `runtimeHours`; hours without critical incident
- `threatsDetected`; array of incident types
- `injectionBlocks`; prompt injection blocks in period
- `sandboxViolations`; sandbox escape attempts

**Schedule:** Weekly attestation (not per-event; cost control). First live attestation pending 30-day clean runtime window.

### 5.5 Public Trust API

`GET https://console.labyrinthscout.com/api/public/trust`

Returns live, real-time trust data:
```json
{
  "risk_score": 20,
  "identity": {
    "status": "live",
    "agent_id": "6981",
    "slug": "carina-reference",
    "explorer_url": "https://sepolia.basescan.org/..."
  },
  "verification": {
    "on_chain": [
      {"type": "erc8126_wav", "tx_hash": "0x...", "score": 15},
      {"type": "erc8126_wv", "tx_hash": "0x...", "score": 10}
    ]
  },
  "chain": {
    "network": "base-sepolia",
    "erc8004_status": "live",
    "erc8126_status": "live"
  },
  "data_freshness": {
    "stale": false,
    "last_updated": "2026-06-11T..."
  }
}
```

### 5.6 Trust Dashboard

`https://carinaai.uk/trust`; Public-facing dashboard that polls the Scout trust API:
- Live risk score with colour-coded tier
- ERC-8004 identity verification status
- ERC-8126 verification explorer links
- Attestation history
- Incident timeline
- Honesty banner when chain data is pre-mainnet

### 5.7 Enterprise Trust Features

- **Compliance Report Generator**; SOC2 / ISO27001 / EU AI Act readiness export (PDF)
- **Attestation History Panel**; Full historical attestation timeline in Scout console
- **Incident Timeline**; Type 1/2/3 classified security events
- **Trust-Gating API**; `GET /api/public/trust/verify/:agentId` for third-party services to check agent trust before accepting actions
- **Configurable Attestation Frequency**; Daily/weekly/monthly per enterprise tier
- **Self-Serve Onboarding**; Account registration → Scout pairing → first attestation

### 5.8 Chain Strategy

- **Current:** Base Sepolia (testnet); live and verifiable
- **Next:** Base Mainnet; operator runs `pnpm trust:register:mainnet`
- **Why Base:** Coinbase L2, low fees, ERC-8004 support, Agent Trust live on Base mainnet, largest x402 market share (60%)

---

## 6. Multi-Tenancy & SaaS (4AS)

### 6.1 Architecture Codename: 4AS (Autonomous Agent as a Service)

Same engine, two deployment modes. No fork.

```
┌─────────────────────────────────────────────┐
│              Carina Agent Engine             │
│  (tools, skills, memory, model routing)      │
├─────────────────────────────────────────────┤
│              Carina Core API                 │
│  (REST endpoints, WebSocket for streaming)   │
├──────────────────────┬──────────────────────┤
│     Self-Hosted      │    Cloud (SaaS)       │
│  npm install carina  │  carinaai.uk          │
│  Local SQLite/Redis  │  Managed Postgres     │
│  Your API keys       │  Our API keys         │
│  Your models         │  Hosted models        │
│  You manage it       │  We manage it         │
└──────────────────────┴──────────────────────┘
```

### 6.2 Tenant Isolation

- `tenant_id` on every database table
- Postgres Row-Level Security: `WHERE tenant_id = current_setting('app.tenant_id')`
- Per-tenant Redis key namespacing
- Per-tenant system-prompt overlay (Carina persona with custom tone/rules)
- Scout threat isolation per tenant

### 6.3 BYOK (Bring Your Own Key)

Tenants bring their own LLM API keys. Carina never pays for inference.

- `tenant_provider_keys` table: tenant_id, provider, encrypted_api_key, custom_base_url, custom_model
- AES-256-CBC encryption via `TENANT_KEY_ENCRYPTION_KEY` env var
- `LLMRouter.chatRouted()` checks tenant override before global config fallback
- REST API: GET/POST/DELETE `/api/tenant/providers`

### 6.4 Billing (Stripe)

- **Usage-based metering**; per-token consumption tracking
- **Tiered plans**; Free / Pro / Teams / Enterprise
- **Stripe Billing integration**; subscriptions, invoices, payment methods
- **Scout add-on**; separate subscription line item for Scout security
- **Usage dashboard**; per-tenant token consumption, cost projection

### 6.5 Session Externalization

Agent state moved from in-memory `Map<sessionId, CarinaOrchestrator>` to Redis for horizontal scaling:
- Any server instance can pick up any user's session
- Stateless instances behind load balancer
- Redis pub/sub for cross-instance communication

### 6.6 Cross-Platform Session Unification

`CARINA_OPERATOR_SESSION=true` unifies all channels into one operator-level session. The session key changes from `carina:agent:<id>:gateway:<source>:<externalUserId>` to `carina:agent:<id>:gateway:operator`; Telegram, web, and CLI all share the same conversation.

---

## 7. Deployment & Operations

### 7.1 Build Pipeline

1. **Claude** reads `prompts/` → writes `action-prompts/` (build instructions)
2. **Codex or Cursor** reads `action-prompts/` → builds code → commits
3. **Deploy:** Local `pnpm build` → rsync dist/ to VPS → npm install → supervisor restart
4. **Verify:** curl health endpoints, check dashboard loads

### 7.2 Deploy Commands

```bash
# Build
cd /opt/lampp/htdocs/verlox/carina/core.carinaai.uk
pnpm build

# Deploy core
rsync -avz --delete -e "ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519" \
  dist/ malike@80.190.81.208:/home/malike/apps/core.carinaai.uk/dist/

# Install + restart
ssh malike@80.190.81.208 "cd /home/malike/apps/core.carinaai.uk && npm install"
ssh malike@80.190.81.208 "sudo supervisorctl restart carina-core"

# Verify
ssh malike@80.190.81.208 "curl -s -o /dev/null -w '%{http_code}' http://localhost:3333/api/health"
```

### 7.3 Supervisor Services

| Service | Port | Description |
|---------|------|-------------|
| carina-core | 3333 | Core agent API |
| labyrinth-scout | 4444 | Scout security console |
| carina-ops | 4002 | Operations dashboard |

### 7.4 Production URL Map

| URL | What it is |
|-----|-----------|
| carinaai.uk | Static marketing HTML (nginx) |
| carinaai.uk/trust | Trust dashboard (polls Scout API) |
| core.carinaai.uk | Agent engine (Express, port 3333, login-gated) |
| app.carinaai.uk | Propreneur Laravel (PHP-FPM; separate product) |
| labyrinthscout.com | Static marketing + waitlist |
| console.labyrinthscout.com | Scout server (Express, port 4444, Basic Auth) |
| console.labyrinthscout.com/api/public/trust | Public trust API (no auth needed) |
| ops.carinaai.uk | Operations panel (port 4002, login-gated) |

### 7.5 Operations CLI

`carina ops` provides:
- **Sandbox**; Isolated execution environments
- **DNS helpers**; Domain configuration
- **Proxy management**; Reverse proxy setup
- **Backup/restore**; State snapshots
- **Secrets management**; Credential rotation
- **Security audit**; Security posture checks
- **Doctor**; Readiness checks (Scout + trust + env validation)

### 7.6 npm Package

`carina-agent` v0.1.0 published on npm:
```bash
npm install -g carina-agent
carina chat        # Interactive agent session
carina serve       # Start local server
carina config      # Configuration management
carina doctor      # Readiness check
carina ops         # Operations commands
```

---

## 8. Domain Packs & Extensibility

### 8.1 Pack Architecture

```
domain-packs/
├── property-uk/          # Reference implementation
│   ├── prompts/          # Domain-specific prompts
│   ├── tools/            # Domain-specific tools
│   ├── models/           # Fine-tuned model configs
│   ├── data/             # Static data (regulations, rates)
│   └── SKILL.md          # Pack manifest
├── healthcare/
├── finance/
├── legal-uk/
├── core-engineering/
├── creative-basics/
├── data-science/
├── devops/
├── email-extended/
├── media-extended/
├── mlops/
├── productivity/
├── research-basics/
├── sales-crm/
├── smart-home/
├── social-extended/
└── template/             # Copy to create new pack
```

### 8.2 Property-UK Pack (Reference Implementation)

The first vertical domain pack, shipping with:
- UK property law database (queried directly, not through prompts)
- HMO regulations by postcode (different councils, different rules)
- Live Rightmove/Zoopla/OnTheMarket price feeds
- Mortgage rate feeds
- Land Registry sold prices (indexed locally)
- Floor plan analysis (vision model)
- Compliance checking (HMO, safety certificates, EPC)
- Rent arrears tracking
- Portfolio summary generation

### 8.3 Creating a Domain Pack

1. Copy `template/` directory
2. Add domain-specific prompts in `prompts/`
3. Implement domain tools in `tools/`
4. Configure models in `models/`
5. Add static reference data in `data/`
6. Write `SKILL.md` manifest
7. Test with `carina doctor --pack <name>`
8. Publish to Carina Hub

### 8.4 Tool Registration API

- Plugin interface for custom tools
- Hot-reload: add a tool file, Carina detects and registers it
- Tool lifecycle: register → validate → execute → audit
- Tool sandboxing: each tool runs in isolated context
- Error handling: tool failure must not crash the agent

### 8.5 Domain Pack Marketplace (Future)

- Public registry for community packs
- Private registry for enterprise packs
- One-click install from marketplace
- Versioning with changelogs
- Community ratings and reviews
- 20% marketplace revenue share to Carina

---

## 9. Competitive Positioning

### 9.1 Carina vs Major Competitors

| | Carina + Scout | Hermes | OpenClaw | ChatGPT | Claude | Copilot |
|---|---|---|---|---|---|---|
| **Open source (MIT)** | Yes | Yes | Yes | No | No | No |
| **Self-host option** | Yes | Yes | Yes | No | No | No |
| **Domain packs** | 18 verticals | No | No | No | No | No |
| **Security layer** | Scout (SIEM) | Partial (Tirith) | Limited | No | No | No |
| **On-chain trust** | ERC-8004/8126 | No | No | No | No | No |
| **Prompt injection shield** | 3-layer | Partial | Limited | Enterprise | Enterprise | No |
| **Kill switch** | Yes | No | No | No | No | No |
| **Audit logging** | Full + immutable | Basic | Partial | Enterprise | Enterprise | No |
| **DLP/egress filtering** | Yes | No | No | Enterprise | Enterprise | No |
| **Honeypots/deception** | Yes | No | No | No | No | No |
| **Multi-channel** | 18 platforms | 15+ | Several | Web, app | Web, app | Editor |
| **Tools** | 71 | 99+ | Limited | Limited | Limited | Limited |
| **Skills** | 96 curated | 115+ | ClawHub | No | No | No |
| **BYOK** | Yes (encrypted) | Config | Config | No | No | No |
| **Stripe billing** | Yes (SaaS) | No | No | Built-in | Built-in | Built-in |
| **npm install** | Yes | Binary | Git clone | No | No | No |
| **Vertical packs** | Property-UK + | No | No | No | No | No |

### 9.2 Scout vs Trust/Security Platforms

| | Labyrinth Scout | Agent Trust | ClawTrust | Mnemom | AXIS | AURA |
|---|---|---|---|---|---|---|
| **Real-time SIEM** | Yes | No | No | No | No | Internal |
| **On-chain attestations** | Yes (custom) | Yes | No | Yes (ZK) | Yes | No |
| **Kill switch** | Yes | No | No | No | No | No |
| **6-channel alerting** | Yes | No | No | No | No | Yes |
| **Agent integration adapters** | 6 platforms | SDK only | OpenClaw only | API | API | Enterprise |
| **GDPR/compliance exports** | Yes | No | No | No | No | Yes |
| **OpenAI proxy** | Yes | No | No | No | No | No |
| **Open source** | MIT | SDK open | MIT | Open core | Closed | Closed |
| **Pricing** | £79-99/mo | Free | Free | Paid tiers | Free (personal) | Enterprise |

### 9.3 Unique Selling Points

1. **Only agent with built-in SIEM**; Labyrinth Scout provides real-time security monitoring that no other agent platform offers
2. **Only verifiable agent**; On-chain identity (ERC-8004) and security verification (ERC-8126) means Carina's security posture is provable, not claimed
3. **Only vertical-first agent**; Domain packs with actual queried knowledge bases, not just prompts
4. **Open source with SaaS option**; MIT license + managed cloud = open-source adoption funnel → SaaS revenue
5. **BYOK encryption**; Tenants keep control of their API keys, encrypted at rest
6. **Carina + Scout = one product**; Not bolted-on security, integrated from architecture

---

## 10. Roadmap & Current Status

### 10.1 Current Status (June 2026)

| Area | Status | Details |
|------|--------|---------|
| **Agent engine** | LIVE | 71 tools, 96 skills, 18 channels |
| **Core API** | LIVE | core.carinaai.uk, port 3333 |
| **Scout console** | LIVE | console.labyrinthscout.com, port 4444 |
| **Ops dashboard** | LIVE | ops.carinaai.uk, port 4002 |
| **Trust API** | LIVE | Public trust API returning real metrics |
| **ERC-8004 identity** | LIVE | Agent #6981 on Base Sepolia |
| **ERC-8126 verification** | LIVE | On-chain verification on Base Sepolia |
| **Prompt injection shield** | LIVE | 3-layer detection |
| **Kill switch** | LIVE | Global + per-instance + per-tool |
| **Audit logging** | LIVE | Immutable, searchable, GDPR-compliant |
| **Deception layer** | LIVE | Honeypots + moving target markers |
| **Egress filtering** | LIVE | DLP + allowlist enforcement |
| **Alerting** | LIVE | 6 channels with SLA |
| **Stripe billing** | LIVE | Placeholder key; routes exist |
| **BYOK** | LIVE | AES-256-CBC encrypted tenant keys |
| **npm package** | LIVE | `carina-agent` v0.1.0 |
| **Agent integration adapters** | LIVE | 6 platforms |
| **OpenAI proxy** | LIVE | Transparent proxy with injection scanning |
| **Domain packs** | PARTIAL | 16 packs shipped, property-UK as reference |
| **Enterprise compliance reports** | LIVE | SOC2/ISO27001/EU AI Act PDF export |
| **Base mainnet** | PENDING | Operator runs `pnpm trust:register:mainnet` |
| **Weekly attestation** | PENDING | First `labyrinth-scout.v1` attestation post |
| **Enterprise pilots** | PENDING | 0 paying pilots |
| **MRR** | PENDING | £0 (pre-revenue) |

### 10.2 Five-Phase Roadmap

| Phase | Duration | Focus | Status |
|-------|----------|-------|--------|
| **1: Property + Security** | 5 weeks | Working property agent with Scout | Core LIVE |
| **2: Power Tools** | 6 weeks | Full Hermes tool parity (71 tools) | LIVE |
| **3: Skill Ecosystem** | 5 weeks | 96 skills + domain pack system | LIVE (16/18 packs) |
| **4: OpenClaw Features** | 4 weeks | Workspace intelligence + heartbeat | PARTIAL |
| **5: Advanced** | 8 weeks | Local models, cross-agent, marketplace | FUTURE |

**Total:** 28 weeks. Ship every 4-6 weeks.

### 10.3 Immediate Next Steps

1. First weekly `labyrinth-scout.v1` attestation post (operator runs `pnpm trust:attest`)
2. Base mainnet ERC-8004 registration (`pnpm trust:register:mainnet`)
3. Enterprise pilot identification (5 target enterprises in regulated sectors)
4. First paid pilot (£2,500-5,000/mo for Scout + attestations)

---

## 11. Pricing & Business Model

### 11.1 Carina Cloud (SaaS)

| Tier | Price | Tokens/mo | Workspaces | Support | Scout |
|------|-------|-----------|------------|---------|-------|
| **Free** | £0 | 10,000 | 1 | Community |; |
| **Pro** | £29/mo | 500,000 | 5 | Email | Basic |
| **Teams** | £99/mo | 2,000,000 | 20 | Priority | Pro |
| **Enterprise** | Custom | Custom | Unlimited | Dedicated + SLA | Enterprise |

Usage overage at cost + 30% margin.

### 11.2 Scout Add-On

| Tier | Price | Features |
|------|-------|----------|
| **Scout Basic** | £79/mo | Prompt injection shield, audit log, kill switch, 1 channel alerting |
| **Scout Pro** | £99/mo | + Deception layer, egress filtering, 6-channel alerting, compliance reports |
| **Scout Enterprise** | Custom | + Daily attestations, dedicated instance, custom SLA, integration adapters |

### 11.3 Self-Hosted (CLI)

- **Price:** Free (MIT license)
- **Revenue:** $0; this is the open-source funnel, not the business
- **Model:** Users bring their own API keys
- **Strategy:** CLI adoption → SaaS conversion + Scout upsell

### 11.4 Domain Pack Marketplace (Future)

- Community packs: Free
- Premium packs: 70% to author, 20% to Carina, 10% platform costs
- Enterprise packs: Custom pricing

### 11.5 Revenue Targets (12 months)

- MRR: £10K+ (solo founder viability threshold)
- First paying customer: < 45 days from trust stack launch
- Scout alerts: < 1 critical per 1,000 agent actions

---

## 12. AI Governance & Regulatory Compliance

### 12.1 Governance Positioning

Labyrinth Scout is **AI agent governance infrastructure**, not just a SIEM. It addresses the three pillars of every serious AI governance framework:

| Pillar | Regulatory requirement | Scout's answer |
|--------|----------------------|----------------|
| **Transparency** | Know what the agent did and why | Immutable audit log + on-chain hashes |
| **Accountability** | Know who deployed the agent | ERC-8004 on-chain identity |
| **Control** | Ability to intervene | Kill switch + tool allowlisting + rate limiting |

### 12.2 EU AI Act Readiness

The EU AI Act (enforcement starts August 2026) mandates for high-risk AI systems:

- **Article 12:** Record-keeping; Scout audit logging
- **Article 14:** Human oversight with "human-machine interface tools"; Kill switch + dashboard
- **Article 15:** Accuracy, robustness, cybersecurity; Prompt injection shield + anomaly detection
- **Article 17:** Quality management system; Compliance report exports
- **Article 61:** Post-market monitoring; Scout real-time monitoring
- **Article 62:** Reporting of serious incidents; Alerting with SLA

Scout's compliance report generator produces EU AI Act readiness assessments mapping Scout controls to specific articles.

### 12.3 UK Regulatory Context

The UK is taking a pro-innovation approach (no AI-specific legislation yet), but the DSIT white paper expects:
- Appropriate transparency and explainability
- Contestability and redress
- Safety and robustness

Scout addresses all three. UK-regulated sectors (property, legal, finance; Carina's target verticals) will adopt these standards voluntarily to avoid future mandated compliance.

### 12.4 Enterprise Procurement Readiness

Before any enterprise deploys an autonomous agent, their security team requires:

1. **Logging**; What did it do? → Scout audit log
2. **Monitoring**; Is it safe right now? → Scout real-time dashboard
3. **Escalation path**; What happens if something goes wrong? → Alerting + SLA
4. **Accountability**; Who is responsible? → ERC-8004 identity
5. **Proof**; Can we verify the logs are real? → On-chain attestations

Scout answers all five. This is enterprise buying behaviour happening now; not future regulation.

### 12.5 Industry-Specific Governance

| Industry | Regulations | Scout Governance Templates |
|----------|------------|---------------------------|
| **UK Property** | RICS, AML, data handling | Property-UK governance pack |
| **Legal Tech** | SRA, client confidentiality, privilege | Legal-UK governance pack |
| **Finance** | FCA consumer duty, transaction monitoring | Finance governance pack |
| **Healthcare** | NHS DSPT, GDPR, patient confidentiality | Healthcare governance pack |

### 12.6 What Scout Does NOT Do

Out of scope (and honest about it):
- Organizational SOC2/ISO27001 certification (Vanta, Drata do this; Scout complements them)
- Full company-wide GRC platform
- Automated regulatory filing
- PII scanning at rest (Scout does egress scanning, not database scanning)
- Audit of human-operated systems (Scout is agent-specific)

---

## 13. What Is NOT Yet Built

### 13.1 Honest Gap Analysis

This section exists because trust requires transparency. These are the known gaps as of June 2026.

| Feature | Status | Notes |
|---------|--------|-------|
| Base mainnet registration | NOT DONE | Testnet only; operator step pending |
| Weekly attestation posts | NOT DONE | Code complete; awaiting 30-day clean window |
| Enterprise pilots | NONE | 0 paying customers |
| MRR | £0 | Pre-revenue |
| Local model bundling (Ollama) | NOT DONE | Provider registry exists; bundling + fine-tuned model not shipped |
| Task classifier for model routing | NOT DONE | Architecture designed; not implemented |
| Event-driven DB alerting | NOT DONE | Cron-based today; CDC not implemented |
| Tool result caching with TTL | PARTIAL | Built; TTL configuration needs per-tool tuning |
| Domain pack marketplace | NOT DONE | Architecture designed; not implemented |
| Cross-agent collaboration | NOT DONE | Architecture designed; not implemented |
| npm self-hosted onboarding | NOT DONE | Package published; setup wizard incomplete |
| Mobile app | NOT DONE | Expo push notifications exist; no native app |
| Full horizontal scaling | NOT DONE | Session externalization designed; not deployed |
| Scout alerting configured | PARTIAL | Code paths exist; `SCOUT_ALERT_TO_EMAIL` + `RESEND_API_KEY` need setting |
| Property UK live data feeds | NOT DONE | Feeds configured for Rightmove/Zoopla not live |
| Fine-tuned property model | NOT DONE | Ollama integration exists; model not trained |
| WhatsApp channel | PARTIAL | Adapter exists (Baileys); production config pending |
| Signal channel | PARTIAL | Adapter exists; production config pending |
| iMessage channel | PARTIAL | BlueBubbles adapter exists; config pending |

### 13.2 What Is NOT on the Roadmap

Explicitly out of scope unless strategy changes:
- Custom trust platform from scratch (adopt Agent Trust instead)
- x402 agent payments (future; after trust layer proven)
- Full autonomous agent commerce (wallet, procurement); Tier 4 vision, not now
- SoulChain memory anchoring (evaluate after Phase C)
- ZKP/PDV private data verification (Mnemom alternative)

---

## 14. Glossary

| Term | Definition |
|------|-----------|
| **4AS** | Autonomous Agent as a Service; internal architecture codename for the SaaS deployment model |
| **Agent Trust** | Third-party reputation platform on Base; Scout posts attestations to it via custom namespace |
| **Base** | Coinbase Ethereum L2 blockchain; primary chain for Carina trust operations |
| **Base Sepolia** | Base testnet; current chain for ERC-8004/8126 (live) |
| **BYOK** | Bring Your Own Key; tenants provide their own LLM API keys, encrypted at rest |
| **Carina** | The autonomous agent platform (core.carinaai.uk) |
| **DLP** | Data Loss Prevention; egress filtering that blocks sensitive data from leaving the agent |
| **Domain Pack** | Vertical-specific bundle of prompts, tools, models, and data for an industry |
| **ERC-8004** | Ethereum standard for AI agent identity, reputation, and validation registries |
| **ERC-8126** | Ethereum standard for agent security verification (WAV + WV scoring) |
| **JIT** | Just-In-Time; credentials granted at session scope, not persistent |
| **Labyrinth Scout** | The security and trust verification layer (console.labyrinthscout.com) |
| **Monorepo** | Single repository (`carina-ai`) containing all Carina + Scout + Ops code |
| **Prompt Injection** | Attack where malicious instructions are embedded in user input to override agent behaviour |
| **RLS** | Row-Level Security; Postgres feature for tenant data isolation |
| **SIEM** | Security Information and Event Management; Scout's core monitoring function |
| **SLA** | Service Level Agreement; incident response time targets |
| **WAV** | Weighted Attestation Verification; ERC-8126 risk score from endpoint health + vulnerability scans |
| **WV** | Wallet Verification; ERC-8126 risk score from attestation wallet on-chain history |
| **x402** | Protocol for standardized payment settlement between AI agents |

---

## Appendix A: Key URLs

| URL | Purpose |
|-----|---------|
| https://core.carinaai.uk | Agent engine (login-gated) |
| https://console.labyrinthscout.com | Scout security console (Basic Auth) |
| https://console.labyrinthscout.com/api/public/trust | Public trust API (no auth) |
| https://ops.carinaai.uk | Operations dashboard |
| https://carinaai.uk | Marketing site |
| https://carinaai.uk/trust | Public trust dashboard |
| https://labyrinthscout.com | Scout marketing site |
| https://www.npmjs.com/package/carina-agent | npm package |

## Appendix B: Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `TRUST_CHAIN_RPC` | Base RPC URL for trust operations |
| `TRUST_ATTESTER_PRIVATE_KEY` | Scout attestation wallet private key |
| `TRUST_ERC8004_REGISTRY` | ERC-8004 registry contract address |
| `TENANT_KEY_ENCRYPTION_KEY` | AES-256-CBC key for BYOK encryption |
| `CARINA_OPERATOR_SESSION` | Cross-platform session unification |
| `CARINA_COMMITMENTS_ENABLED` | Inferred follow-up commitment extraction |
| `SCOUT_ALERT_TO_EMAIL` | Alert destination email |
| `LABYRINTH_ENABLED` | Enable Scout integration in Carina |
| `STRIPE_SECRET_KEY` | Stripe API key for billing |

## Appendix C: Repository Contacts

- **Monorepo:** `/opt/lampp/htdocs/verlox/carina/`
- **Instructions:** `/opt/lampp/htdocs/verlox/carina/instructions/`
- **VPS:** `ssh -o IdentitiesOnly=yes -i ~/.ssh/id_ed25519 malike@80.190.81.208`
- **Supervisor:** `sudo supervisorctl status` (on VPS)
