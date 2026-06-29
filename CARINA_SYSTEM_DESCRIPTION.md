# VERLOX System Description: Carina Aiva, Carina Mutant, and Labyrinth Scout

**Date:** 26 June 2026 (updated 29 June 2026 - product rename)
**Author:** Compiled by Herlox from live codebase audit
**Repository:** /opt/lampp/htdocs/verlox/carina_aiva
**GitHub:** malike2356/carina-ai

---

## Product Naming (authoritative as of 29 June 2026)

| Old name | New name | Notes |
|---|---|---|
| Carina (Enterprise) | Carina Aiva | This repo. Node.js core + Aiva bundled. Commercial. |
| Carina CE | Carina Mutant | Separate repo. Python. Community Edition. MIT/AGPL. |
| Scout | Labyrinth Scout | Unchanged. Governs both products. |

Do not use "Carina Enterprise" or "Carina CE" in any new communications.

---

## Table of Contents

1. [Overview](#overview)
2. [Carina Aiva -- The Enterprise AI Platform](#carina)
3. [Aiva -- The AI Employee Product](#aiva)
4. [Labyrinth Scout -- Security Governance Layer](#scout)
5. [Carina Mutant -- The Community Platform](#mutant)
6. [The Tollbooth Architecture](#tollbooth)
7. [Deployment & Infrastructure](#deployment)
8. [What's Built vs What's Planned](#status)

---

## 1. Overview {#overview}

VERLOX builds two AI platforms and one governance product. Together they form
the tollbooth. Each can function independently.

```
Labyrinth Scout    Security governance. On-chain trust. Compliance. Audit.
                   Paid: Monitor £49/mo, Govern £79/mo, Enterprise via quote.
                   Governs both Carina Aiva and Carina Mutant.

Carina Aiva        Enterprise AI platform. Commercial.
                   Carina core (Node.js/TypeScript) + Aiva AI Employee bundled.
                   Aiva tiers: Starter £49/mo, Team £99/mo, Business £299/mo.
                   Domains: carinaai.uk / hireaiva.co.uk
                   Repo: carina_aiva (this repo)

Carina Mutant      Community AI platform. Open source (MIT/AGPL).
                   Python/FastAPI backend. Self-hosted. The Mutant Agent.
                   Free. Developer and security professional audience.
                   Repo: malike2356/carina-mutant
                   Local path: /opt/lampp/htdocs/verlox/carina_mutant
```

A developer self-hosts Carina Mutant for free. A business owner hires Aiva
and gets Carina Aiva underneath. An enterprise adds Labyrinth Scout on top of
either platform for governance, compliance, and blockchain trust.

The tollbooth: Carina Mutant is the free road (open source, community).
Carina Aiva is the managed commercial road (Aiva workers, billing, multi-tenant).
Labyrinth Scout is the governance toll that sits above both.

---

## 5. Carina Mutant -- The Community Platform {#mutant}

Carina Mutant is a separate codebase and separate product. It is NOT a
stripped version of Carina Aiva. It is a community synthesis that:

- Takes Hermes Agent (Python) as the agent core
- Merges Odysseus (Python) workspace features into the backend
- Ports OpenClaw channel adapters and mobile apps
- Copies the Carina Aiva frontend UI (adapted, same visual language)
- Adds the Mutant Agent: self-coding capability with sandbox and approval
- Adds the full cybersecurity/SIEM suite from Kali, Parrot, CSI Linux
- Adds the App Foundation SDK (carina-mutant-sdk / @carina-mutant/sdk)
- Adds the Project Builder (builds any verlox project via NL)
- Adds a Labyrinth Scout governance bridge (client only)

**What Carina Mutant does NOT have (Carina Aiva / Enterprise-only):**
- Labyrinth Scout full product (blockchain trust, on-chain attestation, WAV/WV)
- Aiva AI Employee workers and billing
- Multi-tenant client workspace management
- Kill switch via native Redis pub/sub

**Local path:** /opt/lampp/htdocs/verlox/carina_mutant
**Build spec:** carina_mutant/prompts/ (31 prompts, 00-30)
**License:** MIT (SDK + frontend) / AGPL-3.0 (backend)

---

## 2. Carina Aiva -- The Enterprise AI Platform {#carina}

**Product name:** Carina Aiva (formerly "Carina Enterprise" internally)
**License:** Commercial
**Package:** carina-agent (npm, internal)
**Runtime:** Node.js/TypeScript ESM
**Repo location:** 02-backends/core.carinaai.uk/
**Live at:** https://carinaai.uk

### 2.1 Architecture

Carina is a self-hosted AI agent gateway. It connects messaging channels to
LLM providers through a unified agent runtime. The Gateway is the single
control plane. Every message, every tool call, every memory operation passes
through it.

```
Channel (Telegram, Slack, WhatsApp, etc.)
  -> GatewayRouter (session management, agent routing)
    -> System Prompt Assembly (identity, skills, memory, tools)
      -> LLM Call (23+ providers)
        -> Tool Execution (71+ tools, sandbox, approval)
          -> Response Assembly
            -> Channel Delivery
```

### 2.2 Gateway

The Gateway is a Node.js process that owns all messaging surfaces. It listens
on configurable ports (defaults: 3333 core, 4444 Scout, 4002 ops panel).

**Gateway Router** (`src/gateway/router.ts`, 776 lines):
- Session creation, routing, rotation, eviction
- Channel adapter dispatch (40+ adapters)
- Agent routing by channel, peer, guild, account
- Identity resolution across channels
- Command queue (steer/followup/collect/interrupt)

**Gateway Commands** (`src/gateway/commands.ts`, 776 lines):
- 49+ CLI subcommands for gateway management
- Gateway start/stop/restart/status
- Channel add/remove/configure/test
- Provider management
- Session inspection

### 2.3 Channels (40+ adapters)

**Legacy gateway channels** (`src/gateway/channels/adapters/`):
Discord, Slack, Telegram, WhatsApp (Baileys + API), Signal, iMessage, Matrix,
Google Chat, Microsoft Teams, IRC, Mattermost, Nextcloud Talk, LINE, WeChat,
Feishu, QQ, Zalo, SMS, Voice Call, WebChat, Email, Instagram, LinkedIn,
Mastodon, Messenger, Reddit, Skype, Snapchat, Twitch, Twitter/X, Viber,
Webex, YouTube, and more.

**New worker channels** (`src/channels/adapters/`):
Discord, Email, Slack, SMS, Teams, Telegram, Web, WhatsApp.

Each adapter handles authentication, message format conversion, and
platform-specific features (reactions, threads, embeds, voice notes).

### 2.4 LLM Providers

Plugin-based provider system (`src/providers/`):
- Anthropic (Claude Opus, Sonnet, Haiku, Fable, Mythos)
- OpenAI (GPT-5.5, GPT-5.4, DALL-E 3)
- Google Gemini (3.1 Pro, Flash)
- OpenRouter (multi-provider)
- Together AI
- Ollama (local models)
- vLLM (local models)
- GitHub Copilot (plugin)
- Custom OpenAI-compatible endpoints

Image generation: DALL-E 3, ComfyUI, Fal.ai, Replicate.
Web search: Tavily (default), Brave Search (fallback).

### 2.5 Tools (71+)

**Core tools** (`src/tools/`):
- Code execution (sandboxed)
- Shell (pty-runner)
- File operations (read, write, search, patch)
- Memory (search, get, store)
- Web (search, fetch, browser)
- Email (IMAP, SMTP)
- Messaging (send, channel management)
- Delegation (delegate-task, sub-agents)
- Cron (scheduled tasks, background tasks)
- MCP (Model Context Protocol server/client)
- n8n integration
- Blog, contacts, documents, notes
- TTS (text-to-speech), transcription
- Image, video, audio generation/analysis
- Kanban boards
- Trello, Spotify integrations
- Home Assistant (smart home)
- Vision analysis
- LSP (Language Server Protocol)
- Security (secrets audit, tool risk registry)

**Cyber tools** (`src/tools/cyber/`):
- Recon: nmap, subdomain enumeration, WHOIS, DNS, technology detection
- Vulnerability scanning: nuclei, nikto, wpscan
- Exploitation: Metasploit integration
- Forensics: memory dumps, disk imaging, log analysis
- Traffic analysis: packet capture, protocol analysis
- Web: fuzzing, XSS, SQLi detection
- Wireless: WiFi scanning, Bluetooth
- Reverse engineering: binary analysis
- Privacy: data exfiltration detection
- Reporting: automated report generation

Tools are gated by tier: free tier gets recon only; paid tiers get exploit
and forensics. 72 individual tools organized into categorized directories.

**Research analysis tools** (`src/tools/research/`):
- SPSS/PSPP integration (CLI-driven syntax execution)
- Jamovi REST API integration
- .sav file I/O (pyreadstat)
- Pure Python analysis (descriptive, t-test, ANOVA, regression, chi-square)
- R pipeline (haven + Rscript)
- APA formatting

### 2.6 Memory System (5 backends)

| Backend | Type | Use Case |
|---------|------|----------|
| Builtin | SQLite + FTS5 | Default, no extra deps |
| PostgreSQL | pgvector | Full-text search, RAG embeddings |
| SQLite | Local file | Single-machine deployments |
| Honcho | AI-native | User modeling, cross-session |
| Mem0 | Embeddings | Semantic search, auto-capture |

**Memory components** (67 files):
- Session transcripts (JSONL)
- Episodic memory (PostgreSQL with pgvector)
- REM (Reflective Episodic Memory) -- nightly dreaming, promotion
- FTS5 full-text session search
- User modeling (Honcho-based)
- Channel-scoped memory
- Workspace context (AGENTS.md, SOUL.md, MEMORY.md, TOOLS.md)
- Context budget management
- Compaction and auto-flush

### 2.7 Skill Packs (23 built-in)

Internal packs covering: automation, borehole-africa, capabilities-ops,
cms-ops, core-engineering, creative-basics, data-science, devops,
email-extended, finance, legal-uk, marketing-ops, media-extended,
meeting-ops, mlops, operator-daily, productivity, recruitment,
research-basics, sales-crm, smart-home, social-extended, plus template.

External bundles: property-uk, healthcare, borehole-africa, research-analysis.

Skills Hub: marketplace with builtin catalog, install, registry, store,
submissions, validation, security scanning, reviews. Public web UI at
https://carinaai.uk/hub.

### 2.8 CLI (100+ subcommands)

`carina` CLI with subcommand groups:
- gateway (start, stop, status, restart)
- channel (add, remove, configure, test, list)
- provider (add, remove, list, test)
- model (set, list, test, config)
- memory (search, status, dreams, promote)
- session (list, view, clear, prune)
- doctor (diagnostics, --fix, --deep, --json)
- security (audit, scan)
- skills (install, list, update, search)
- plugins (install, enable, disable, list)
- cron (add, list, pause, resume, remove)
- sandbox (mode, config, test)
- doctor, logs, diagnostics
- queue (status, drain, config)

### 2.9 TUI

Ink-based terminal UI (`src/tui/`, 113 files):
- Streaming chat interface
- Multi-panel operator mode (Ctrl+A for panels)
- F-key panels: Scout, Memory, Skills, Logs
- Command palette
- Keyboard shortcuts
- Theme/skin engine

### 2.10 Security (170 files)

- RASP (Runtime Application Self-Protection)
- Prompt injection detection (3-layer: regex + LLM judge + tool result scanning)
- Honeypots (5 decoy categories, 60-min rotation)
- Anomaly detection (z-score baselines, behavioural heuristics)
- Kill switch (global, per-instance, per-tool, per-session) via Redis pub/sub
- Egress filtering / DLP
- JIT privilege escalation
- Policy packs (configurable security policies)
- Auto-remediation
- Forensics (memory dumps, disk imaging, log analysis)
- Penetration testing framework
- Sandbox execution (Docker, SSH, OpenShell)
- Exec approval levels (off, on-miss, full)
- Tripwires and moving target markers

### 2.11 Extensions (10 built-in)

Active-memory, bonjour-discovery, document-extract, file-transfer, llm-task,
memory-wiki, phone-control, skill-workshop, tokenjuice, web-readability.

### 2.12 Other Components

- **ACP** (Agent Communication Protocol): WebSocket bridge for IDE agents
- **MCP** (Model Context Protocol): Server and client implementations
- **n8n bridge**: Integration with n8n workflow automation
- **WebChat**: Browser chat widget, session/auth/context
- **Email ingestion**: IMAP fetcher, SMTP sender
- **SSO/SAML/OIDC**: Enterprise identity federation
- **Blog**: Dual-control incident blog (admin UI + Carina conversation)
- **Compliance**: SOC2, ISO27001, GDPR, EU AI Act, UK DSIT evidence collection

### 2.13 Key Metrics

- 2,196 TypeScript source files in core
- 71+ tools (212 files including cyber suite)
- 40+ channel adapters
- 5 memory backends
- 23 built-in skill packs
- 4 image generation providers
- 10 built-in extensions
- 18+ gateway surfaces
- 100+ CLI subcommands
- ~5,369 Vitest tests
- Docker-based production deployment

---

## 3. Aiva -- The AI Employee Product {#aiva}

**Domain:** hireaiva.co.uk
**Backend:** admin.hireaiva.co.uk (proxied to aiva.carinaai.uk)
**Pricing:** Starter £49/mo, Team £99/mo, Business £299/mo

### 3.1 What Aiva Is

Aiva is an AI Employee. A named, trained, governed AI agent that works
alongside human VAs. It reads emails, manages data, sends daily briefings,
answers customer questions, and handles routine admin. When it cannot handle
something, it escalates to a human VA -- invisibly, in the same channel.

The key differentiator: human-in-the-loop is not an add-on. It is built into
every plan. The handover is invisible to the customer.

### 3.2 Marketing Site

Single-page HTML/CSS at hireaiva.co.uk (2,186 lines, 77KB).

**Hero:** "Hire Aiva. Get your time back."
"Most entrepreneurs don't have a staffing problem. They have a time problem."

**11 sections:**
- Nav, Hero with WhatsApp mock, "Why Aiva is different" (side-by-side comparison)
- "Behind every Aiva: A real team" (AI vs human VA split)
- "Aiva in action" (4 tabbed demo panels: Human handover, Customer query,
  Booking, Morning briefing)
- "Three things every Aiva does" (Always on, Knows your business, Knows when
  to stop)
- "How it works" (3-step onboarding: Define -> Context -> Launch)
- "Role templates" (6 roles: Customer service, Booking, Sales, Property, Tech
  support, Custom)
- Channels (WhatsApp, Email, Slack, Telegram, Web chat)
- "Three guarantees" (Human VA backup, Governance, Audit log)
- Pricing (3 tiers)
- Final CTA ("Your first Aiva is free for 15 days")
- Footer ("Powered by Carina. Monitored by Scout.")

### 3.3 Backend API (1,063 lines)

Mounted at `/api/aiva/`. 30+ endpoints across:
- Worker CRUD (create, list, get, update, pause, dismiss)
- Worker analytics (messages, escalation rate, automations, Scout registration)
- Worker channels (list, toggle, remove per channel)
- Worker activity and audit log
- Worker conversations (channel threads)

Subscription and billing:
- Trial provisioning (15-day, 1 slot, idempotent)
- Subscription status (plan, trial days, slots, usage)
- Stripe checkout session creation (3 tiers, month/year)
- Stripe customer portal
- Downgrade conflict resolution

Automations (Team+):
- CRUD for scheduled automations
- Cron-based scheduling
- Toggle enable/disable

Knowledge base (Business+):
- Document upload (5MB, base64)
- FAQ entry CRUD
- Toggle entries

Propreneur Bridge:
- Bind/unbind workers to Propreneur tenants
- HMAC-signed webhooks
- Status checking

Email ingestion:
- IMAP mailbox connection
- Sender allowlist management
- Daily summary configuration (delivery time, channel, sections)
- Manual poll trigger

Workspace:
- GDPR export (ZIP, Business plan)
- GDPR erasure

### 3.4 Email API (342 lines)

Mounted at `/api/aiva/email/`:
- IMAP connect/disconnect
- Status and recent digests
- Sender management
- Propreneur bridge binding
- Daily summary config
- Manual inbox poll
- Credential verification

### 3.5 Analytics (101 lines)

Mounted at `/api/aiva/analytics/`:
- Summary, volume over time
- Channel breakdown (Team+)
- Escalation rates (Team+)
- Activity heatmap (Team+)
- Per-worker breakdown (Team+)

### 3.6 Billing System

**Stripe integration** (12 billing files):
- Stripe Checkout: creates sessions with product metadata, auto-tax
- Stripe Customer Portal: payment method management
- Webhook handler: subscription lifecycle (activate, sync, suspend, invoice)
- Pricing: Starter £49/mo or £490/yr, Team £99/mo or £990/yr,
  Business £299/mo or £2,990/yr
- Slot model: Starter=1, Team=5, Business=unlimited
- Grace period: 7 days on payment failure
- Usage tracking: trial=200 msgs, Starter=2K, Team=10K, Business=unlimited
- 80% and 100% threshold alerts via email
- Downgrade conflict: if user has more workers than target tier allows, they
  select which to keep

### 3.7 Role Templates (6)

Each template has persona blocks (role, capabilities, boundaries, tone,
escalation guidance), skill packs, default channels, and escalation triggers:

1. **Property Manager** -- property-uk + calendar. Escalates on legal,
   complaint, court, deposit dispute, emergency.
2. **Outreach Coordinator** -- communication + calendar. Escalates on pricing,
   contract, legal, cancel, refund.
3. **Financial Analyst** -- finance + documents. Escalates on payment, bank,
   transfer, fraud, audit.
4. **Content Assistant** -- cms-ops + research-basics. Escalates on legal,
   sensitive, controversial.
5. **Calendar Manager** -- calendar. Escalates on cancel, emergency, urgent,
   board, investor.
6. **Customer Support** -- communication. Escalates on refund, billing dispute,
   legal, angry, escalate, manager.

### 3.8 Human-in-the-Loop Model

**The [ESCALATE] marker system:**
- Workers output `[ESCALATE]` when uncertain
- Message is intercepted, escalation record created
- Holding message sent to customer
- Scout event logged

**Rogue signal detection:**
- Escalation burst (3+ in 60 min) -> critical
- High escalation rate (>40% in 30 min) -> critical
- Volume spike (3x baseline) -> warning
- Tool failure loop (5+ in 30 min) -> warning
- Unauthorized tool attempts -> critical

**Holding message:** Configurable. Default: "I am checking on this and will
get back to you shortly."

### 3.9 Channels Per Worker

Each Aiva worker gets channels provisioned on hire:
- WhatsApp (env creds or user-provided)
- Email (auto-generated slug)
- Slack (channel binding)
- Telegram (auto-register webhook)
- Discord (application ID)
- SMS (number normalization)
- Web (always auto-provisioned)
- Teams (app_id + app_password)

Channel limits by tier: Starter 2, Team/Business unlimited.

### 3.10 Feature Flags

All gated behind environment variables, defaulting conservatively:
- AI_WORKERS_ENABLED (default true)
- EMAIL_INGESTION_ENABLED
- PROPREENEUR_BRIDGE_ENABLED
- PROPREENEUR_BRIDGE_WRITES
- AIVA_DAILY_SUMMARY_ENABLED
- AIVA_BILLING_ENABLED
- AIVA_SCOUT_FLEET_ENABLED

### 3.11 Current Status

Aiva is production-ready for pilot clients. Glenn (property mentor, first IPN
member) is the first target customer. The proposal is at:
01-devends/planning/outreach/glenn-proposal.md

Propreneur Bridge spec exists (sprint-6).
n8n integration tested locally (MCP on port 8765).

---

## 4. Scout -- Security Governance Layer {#scout}

**Console:** console.labyrinthscout.com (Express/TS, 696 files)
**Engine:** scout-engine (60 files)
**Trust site:** trust.labyrinthscout.com
**Marketing:** labyrinthscout.com
**SDK:** 03-frontends/sdks/labyrinth-scout-sdk/ (26 files)
**Pricing:** Monitor £49/mo, Govern £79/mo, Enterprise via quote

### 4.1 What Scout Is

Scout is the security governance layer for AI agents. It provides:

- Real-time prompt injection detection (3-layer)
- Kill switch (global, per-instance, per-tool, per-session)
- Honeypots and deception (5 decoy categories, rotating markers)
- Anomaly detection (z-score baselines)
- Immutable audit logging (GDPR-compliant)
- On-chain trust (ERC-8004 agent identity, ERC-8126 verification)
- Compliance automation (SOC2, ISO27001, GDPR, EU AI Act, UK DSIT)
- 16 scanning engines for external infrastructure
- 11 SIEM/EDR/ticketing connectors

Scout can govern any AI agent -- not just Carina agents. The SDK drops into
any agent framework (OpenAI, LangChain, custom Python).

### 4.2 Console (696 files)

**Security Modules** (24 files):
- PromptGuard: 3-layer injection detection (regex + LLM judge + tool scanning)
- ContextFirewall: blocks sensitive context leakage
- PolicyGateway: configurable security policies
- HoneypotManager: 5 decoy categories, 6 suspicious pattern detectors
- AnomalyDetector: z-score baselines, behavioural heuristics
- AutoRemediation: automatic response to detected threats
- EgressFilter: domain allowlist + sensitive data scanning
- Quarantine: tool-level quarantine
- JTIPrivileges: just-in-time privilege escalation
- Tripwires: detection markers
- SessionShield: per-session protection
- RiskRegistry: agent risk scoring

**Trust Architecture** (21 files):
- ERC-8004 on-chain agent identity on Base L2
- Weekly attestation via @open-agent-economy/trust-sdk
- WAV (Weighted Attestation Value) and WV (Weighted Verification) scoring
- Critical event attestation
- Risk spike monitoring
- Public trust API (0-100 score, no auth required, third-party verifiable)
- Compliance reports (SOC2, ISO27001, EU AI Act, UK DSIT -- PDF export)

**Compliance** (13 files):
- SOC2 TSC mapping (14 controls)
- ISO 27001 framework mapping
- GDPR articles 15, 17, 20 (access, deletion, portability)
- Evidence ingestion and scoring
- Trust center
- Auditor links

**Audit** (8 files):
- Immutable audit logger
- Audit search (full-text, date range, severity filter)
- Audit schemas (standardised event format)
- Retention policies (configurable, GDPR-compliant)
- GDPR data deletion, access, and reporting

**Dashboard** (8 widgets):
- DefenseConsole (7 capabilities: prompt guard, kill switch, honeypots,
  anomaly detection, egress filter, JIT privileges, policy gateway)
- PostureSummary (overall security posture score)
- FleetSummary (agent fleet status)
- UsageAnalytics (tool usage, message volume)
- AgentStatus (per-agent health)
- IncidentOps (incident tracking and response)
- ThreatMetrics (threat statistics)
- ResponseTerminal (real-time response console)

**Governance** (6 files):
- EU AI Act tiering
- UK DSIT alignment
- SOC2 readiness scoring
- GDPR readiness scoring
- ISO42001 readiness scoring
- Board report PDF generation

**External Connectors** (11):
SentinelOne, CrowdStrike Falcon, Microsoft Defender, Wiz, Snyk,
Socket.dev, Semgrep, Jira, ServiceNow, PagerDuty, Generic Webhook.
Each connector: maps Scout severity to vendor severity, attaches MITRE ATT&CK
IDs, pushes via vendor REST API, stores vendor ID for cross-reference.

**Scanning Engines** (16):
nmap, nuclei, nikto, subdomain, spiderfoot, sherlock, whatweb, wpscan,
web-fuzz, harvester, snort, bloodhound, forensics, port-probe, quick-scan
orchestrator, reporting engine.

**Integration Adapters:**
Carina, OpenAI, LangChain, generic, external agent, goal-result.

**Alert Channels:**
Email, Slack, Telegram, SMS, Discord, WhatsApp.

### 4.3 Scout Engine (60 files)

The event ingestion and policy runtime:

- **Event Server:** SSE streaming via Redis pub/sub on `scout:events` channel.
  REST API with 35+ endpoints covering auth, targets, scans, findings, assets,
  Scout Score, agents, alert rules, reports, compliance, webhooks.
- **Scout Score:** Weighted 4-category formula: exposure (25%), vulnerabilities
  (35%), compliance (25%), agent safety (15%). 0-100 scale with 7-day trend.
- **25 Security Tools:** 10 recon, 5 vulnerability scan, 4 fuzzing,
  5 IDS (snort/suricata/zeek as daemons), plus testssl.
- **Suspicious Detector:** 6 patterns (rapid execution, credential access,
  exfiltration, lateral movement, dangerous hours, first-time dangerous tool).
- **Instance Control:** Kill/resume via Redis pub/sub control channel.
- **Scan Scheduler:** Polls every 30s, processes up to 3 targets per tick.

### 4.4 Deception System

5 decoy categories:
- Decoy API keys (fake credentials that trigger alerts on use)
- Honeypot files (fake sensitive documents)
- Honeypot URLs (fake internal endpoints)
- Honeypot email addresses
- Honeypot database tables

Rotation: every 60 minutes. Moving target markers. Stale marker detection.
If an agent accesses a decoy, Scout fires a critical alert immediately.

### 4.5 Scout Score

Public trust API returning 0-100 score for any registered agent:
- Exposure score (25%): public attack surface, open ports, exposed services
- Vulnerability score (35%): known CVEs, patch status, dependency risks
- Compliance score (25%): SOC2, ISO27001, GDPR alignment
- Agent safety score (15%): prompt injection blocks, honeypot triggers,
  anomaly spikes, escalation rates

Updated weekly via automated scan + attestation cycle. Verifiable on-chain
via Base L2.

### 4.6 Public Trust Site

trust.labyrinthscout.com -- public microsite showing:
- Platform decision framework
- Least privilege defaults
- Type 3 runbook
- Public trust API documentation

---

## 5. The Tollbooth Architecture {#tollbooth}

### 5.1 The Visa Analogy

| Layer | Visa | VERLOX |
|-------|------|--------|
| The road | Payment network | Carina Gateway + Scout |
| Who owns the card | Banks | Businesses (Aiva customers) |
| Who lends money | Banks | LLM providers (Anthropic, OpenAI) |
| What travels | Transactions | Agent actions (tool calls, messages, verifications) |
| The toll | Fraction of a cent | Per verification, per agent, per month |
| Why they pay | No road = no commerce | No Scout = no enterprise trust |
| Margin target | 67% | 70%+ (marginal cost near zero) |

### 5.2 How It Works

```
Any AI Agent (Carina, OpenAI, LangChain, custom)
  -> Scout SDK / Proxy
    -> Identity: ERC-8004 on-chain verification
    -> Behaviour: Real-time prompt injection detection
    -> Authorization: Tool allowlist + tier gating
    -> Audit: Immutable record of every action
    -> Compliance: SOC2/ISO27001/GDPR report auto-generated
      -> Business API (bank, healthcare, government)
```

The agent builder gets Scout verification. The business trusting the agent gets
Scout protection. Both sides pay the toll. Carina doesn't need to own the agent.
It owns the road.

### 5.3 The Moat

- **MIT license.** Free to build on. Free to fork. The road is open. The trust
  layer (Scout) is paid. Red Hat model: free software, paid enterprise trust.
- **On-chain trust.** ERC-8004 agent registration. Public risk score API.
  Weekly attestations. Nobody else has this. Building it took months.
- **Already live.** Carina processes real agent traffic. Scout detects real
  threats. The infrastructure exists. Competitors are still writing READMEs.
- **First mover in AI governance.** When regulators require AI agent audits,
  Scout is already the standard. The regulation IS the tollbooth.

### 5.4 The On-Ramps

| On-Ramp | What It Does | Status |
|---------|-------------|--------|
| Scout SDK | Drop into any agent framework | Built |
| Scout Proxy | Transparent HTTP proxy, no code changes | Spec'd |
| OpenAI-compatible API | Any tool speaking OpenAI API routes through Carina | In prompts |
| ACP Adapter | IDE agents route through Carina | Built |
| n8n Node | No-code automation platforms route through Scout | Local testing |
| Generic Webhook | Any HTTP endpoint receives Scout findings | Built |

### 5.5 The Visa Moment

When a UK bank says: "our AI agents must pass Scout verification before
accessing customer data."

When an NHS trust says: "all AI clinical tools must be Scout-governed."

When regulators write: "AI agents must maintain immutable audit trails"
and Scout already does it.

That's the tollbooth.

---

## 6. Deployment & Infrastructure {#deployment}

### 6.1 Repository Structure

```
/opt/lampp/htdocs/verlox/carina/
  01-devends/          Planning, prompts, strategy, SOP
  02-backends/         All backend services
  03-frontends/        All frontends and marketing sites
  scripts/             Deployment, security, maintenance
  docker/              Dockerfiles, nginx, supervisor, backups
```

Total: ~49,600 files (excluding node_modules, dist, .next).

### 6.2 Production Hosts

All on Contabo VPS (80.190.81.208):
- core.carinaai.uk -> /home/malike/apps/core.carinaai.uk
- ops.carinaai.uk -> /home/malike/apps/ops.carinaai.uk (port 4002)
- console.labyrinthscout.com -> /home/malike/apps/console.labyrinthscout.com

Docker-based deployment with supervisor for process management.

### 6.3 Domains

| Domain | Purpose |
|--------|---------|
| carinaai.uk | Developer platform, docs, open-source |
| hireaiva.co.uk | Aiva marketing site |
| admin.hireaiva.co.uk | Aiva backend (proxied to aiva.carinaai.uk) |
| app.carinaai.uk | Hosted SaaS (Next.js) |
| labyrinthscout.com | Scout marketing + console |
| trust.labyrinthscout.com | Public trust site |
| docs.carinaai.uk | Docusaurus documentation |
| hub.carinaai.uk | Skills marketplace |
| verlox.uk | Holding company |

### 6.4 CI/CD

- GitHub Actions CI on push to main
- Deploy scripts: deploy-carina.sh, deploy-scout.sh, deploy-marketing.sh
- Docker Compose production stacks with nginx, pgbouncer, postgres
- Atomic deploys with health checks
- PostgreSQL backups (WAL, scheduled, rclone to cloud)
- fail2ban, logrotate, security hardening

### 6.5 Frontend Products

| Product | Type | Framework |
|---------|------|-----------|
| app.carinaai.uk | Hosted SaaS | Next.js 15, 705 files |
| admin.carinaai.uk | Admin dashboard | Next.js, 103 files |
| carinaMobile | Mobile app | Expo Router, 301 files |
| carina-desktop | Desktop app | Tauri/Vite, 11,399 files |
| hireaiva.co.uk | Marketing | Static HTML, 22 files |
| carinaai.uk | Marketing | Static HTML, 311 files |
| labyrinthscout.com | Marketing + docs | Static + Docusaurus |

### 6.6 SDKs

| SDK | Language | Files |
|-----|----------|-------|
| carina-agent-public | TypeScript | 1,179 files (npm export mirror) |
| labyrinth-scout-sdk | TypeScript | 26 files |

### 6.7 IDE Extensions

| Extension | Editor | Files |
|-----------|--------|-------|
| carina-ide | VS Code | 17 files |
| carina-jetbrains | JetBrains | 91 files |

---

## 7. What's Built vs What's Planned {#status}

### 7.1 Built and Live

- Carina core: 2,196 TS files, 71+ tools, 40+ channels, 5 memory backends,
  23 skill packs, 100+ CLI commands, TUI, Docker deployment
- Scout: 696 TS files, 24 security modules, 16 scanning engines, 11 external
  connectors, trust architecture, compliance automation, deception system
- Aiva: 30+ API endpoints, Stripe billing (3 tiers), 6 role templates,
  human-in-the-loop escalation, worker provisioning, email ingestion,
  analytics, knowledge base, Propreneur bridge
- Marketing: carinaai.uk, hireaiva.co.uk, labyrinthscout.com, trust site,
  Docusaurus docs, skills hub

### 7.2 In Progress (prompts written)

- Scout partnership connectors (gap-31): SentinelOne, CrowdStrike, Defender,
  Wiz, Snyk, Socket, Semgrep, Jira, ServiceNow, PagerDuty, Generic webhook
- Claude Tag-inspired channel agent: passive reading, ambient mode, channel
  memory, @mention trigger
- Research app integration: PSPP, Jamovi, .sav I/O, R pipeline, analysis pack
- Documentation gaps: install, onboarding, channels, architecture, plugins,
  automation, operations, model providers, sandbox/security
- Implementation gaps: command queue, standing orders, identity links,
  node system, thinking architecture, sandbox isolation, OpenAI-compatible API

### 7.3 Planned / Spec'd

- Scout HTTPS proxy (transparent governance for any agent)
- Aiva self-serve onboarding pipeline
- Usage-based billing (per-verification pricing)
- Scout marketplace
- Fleet management dashboard
- Propreneur bridge completion
- n8n integration hardening
- iLaud/xeclone multimodal clone
- Papa Lord incubation proposal

### 7.4 The Next Six Months

1. **Ship Aiva to Glenn.** First paying customer. Prove the model.
2. **Open Scout to external agents.** Scout SDK and proxy for non-Carina agents.
3. **Build the marketplace.** Companies list agents on Scout. Verified. Scored.
4. **Target regulated industries.** NHS, finance, legal. Use the tollbooth pitch.
5. **Scale Aiva.** From 1 customer to 10 to 100. Self-serve onboarding.

---

*This document was compiled from a live audit of the Carina monorepo at
/opt/lampp/htdocs/verlox/carina on 26 June 2026. Every claim is backed by
source files that exist on disk.*
