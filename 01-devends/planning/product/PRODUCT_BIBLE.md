# Carina + Labyrinth Scout: Product Bible

The single authoritative reference for the Carina AI platform and Labyrinth Scout security layer. Covers every module, every sub-project, every feature, every integration point, and every deployment surface. Version: 2026-06. Maintained by VERLOX. Last updated: 15 June 2026.

---

## Table of Contents

1. Platform Overview
2. Architecture and Product Map
3. Carina Core (core.carinaai.uk)
4. Carina Agent Public Package (npm)
5. Carina Cloud / Hosted SaaS (app.carinaai.uk)
6. Carina Ops Dashboard (ops.carinaai.uk)
7. Carina Mobile (carinaMobile)
8. Carina IDE Extensions
9. Carina Hub (Skill Discovery)
10. Carina Docs Site (docs.carinaai.uk)
11. Carina Marketing Site (carinaai.uk)
12. Labyrinth Scout Console (console.labyrinthscout.com)
13. Labyrinth Scout SDK (npm)
14. Labyrinth Scout Marketing Site (labyrinthscout.com)
15. Trust Layer (ERC-8004 / ERC-8126 / Blockchain)
16. LLM Provider Catalog
17. Channel Adapter Catalog
18. Tool Catalog
19. Domain Pack Catalog
20. Memory Backend Catalog
21. Security Layer (Prompt Guard / Kill Switch / JIT / Deception)
22. Billing and Subscription Model
23. Deployment and Infrastructure
24. Testing Coverage
25. Competitive Positioning
26. Roadmap and Current Status
27. A-Z Glossary / Feature Index

---

## 1. Platform Overview

Carina is an open-source (MIT) AI agent kernel built in Portsmouth, UK. It provides everything an agent needs: tools, memory, channels, model routing, skill packs, and security -- so teams can focus on what their agent does, not how it runs.

Labyrinth Scout is the paid commercial security add-on that watches Carina instances for misbehaviour: prompt injection, runaway tool use, secret leakage, unauthorized egress, and anomaly detection. Scout is to Carina what SELinux/AppArmor is to Linux.

Two product lines in one monorepo under pnpm workspaces:

| Product | License | Role | Audience |
|---------|---------|------|----------|
| Carina Agent | MIT (free forever) | Agent kernel: tools, memory, channels, routing | Developers, ISVs, researchers, students |
| Labyrinth Scout | Commercial (paid) | Security monitoring, kill switch, audit, trust verification | Production operators, enterprises |

### Platform at a Glance (v0.2.0)

| Metric | Count |
|--------|-------|
| LLM providers registered | 51 (40 routable for chat; 6 external-CLI; 1 OAuth; 3 aliases; 1 embeddings-only) |
| Channel adapters | 44+ (Core) / 18 (Public npm); 30+ unique platforms |
| Tools | 53+ (Core) / 71+ with integrations and browser tools |
| Domain packs | 16 |
| Memory backends | 5 (builtin, SQLite, PostgreSQL+pgvector, Mem0, Honcho) |
| Security modules | 30+ in Core, 50+ in Scout Console |
| Alert channels (Scout) | 6 (Discord, Email, Slack, SMS, Telegram, WhatsApp) |
| Alert severity levels | 4 (breach, critical, warning, info) |
| Scout subscription tiers | 4 (scout_monitor, scout_standard, scout_pro, enterprise) |
| Core TypeScript source files | 760 (49 directories) |
| Core test files | 406 |
| Scout Console source files | 181 |
| Scout Console test files | 146 |
| Mobile source files | 121 |
| Public npm CLI commands | 58 |
| Ops dashboard route modules | 15 |
| Ops dashboard EJS views | 19 |
| Brain knowledge markdown files | 618+ |
| Instruction documents | 352 .md files |
| Deployment scripts | 17 |

### The Three-Layer Architecture

```
Layer 3: Trust  (Blockchain ERC-8004/ERC-8126, public attestation)
Layer 2: Scout  (Security monitoring, kill switch, audit, deception)
Layer 1: Carina (Agent kernel: tools, memory, channels, model routing)
```

Scout is optional. Carina runs identically without it. When you need production governance, you add Scout.

### The Linux Analogy

| Layer | Linux World | Carina World |
|-------|-------------|-------------|
| Kernel | Linux (GPL, free) | Carina (MIT, free) |
| Security | SELinux, AppArmor | Scout (commercial) |
| Enterprise | RHEL, SUSE | Carina Enterprise / Carina Ops / Carina Cloud |
| Distros | Ubuntu, Fedora | Propreneur, Flitz, COMPASS, ABBIS etc. |
| Packages | apt, pacman | Carina Hub, `carina pack install` |
| Modules | Drivers | Tools, MCP servers, community plugins |

### Carina Named After the Constellation

Carina is a constellation in the southern sky. Its name comes from Latin, meaning "keel" -- the main structural piece of a ship. The keel is not flashy, but nothing works without it. That is the idea behind Carina: the stable, invisible foundation every AI agent needs.

---

## 2. Architecture and Product Map

### Product Map (Production, June 2026)

| Host | Product | Audience | Port |
|------|---------|----------|------|
| app.carinaai.uk | Carina Cloud (hosted SaaS) | Paying and free tenants | 3333 |
| core.carinaai.uk | Private operator Carina | VERLOX only | 3333 |
| console.labyrinthscout.com | Labyrinth Scout server | Tenants (Pro) + VERLOX operators | 4444 |
| ops.carinaai.uk | Platform admin | VERLOX only | 4002 |
| carinaai.uk | Marketing site | Public | static |
| labyrinthscout.com | Scout marketing + waitlist | Public | static |

### The Five Pieces

| Piece | Directory | Port (local) | Shipped to Customers? |
|-------|-----------|-------------|----------------------|
| Carina agent | core.carinaai.uk/ | 3333 | Yes -- npm package + Docker image |
| Carina IDE extensions | extensions/carina-ide/, extensions/carina-jetbrains/ | n/a | Yes -- VSIX/ZIP |
| Carina marketing | carinaai.uk/ | static | Yes -- static files |
| Platform admin (ops) | ops.carinaai.uk/ | 4002 | No -- VERLOX only |
| Labyrinth Scout console | console.labyrinthscout.com/ | 4444 | Yes -- Docker image verlox/scout |
| Scout marketing | labyrinthscout.com/ | static | Yes -- static files |

### How They Connect

#### Carina -> Scout: Security Event Reporting
```
Carina agent  ->  src/security/scout-client.ts  ->  POST {SCOUT_URL}/api/events
                                                  ->  POST {SCOUT_URL}/api/heartbeat
```
- scout-client.ts batches ScoutEvent records and POSTs them to the paired Scout console.
- Auth via X-Scout-Key header with scoped per-account API keys.
- sanitiseParams() redacts secrets (API key patterns, bearer tokens, 64-char hex blobs) before transmission.
- Fire-and-forget with 2-second timeout. Scout never blocks Carina.
- Controlled entirely by env vars. LABYRINTH_ENABLED=false means zero integration.

#### Scout -> Carina: Kill Switch (Control Channel)
```
Scout  ->  Redis pub: "labyrinth:control"  ->  src/security/kill-switch-listener.ts
```
- Scout can push back through a single Redis channel to suspend, throttle, or quarantine a specific Carina instance.
- Kill-switch-listener.ts applies payloads addressed to its own instance_id:
  - suspend/resume (halts/resumes the whole agent)
  - Block a specific session (isSessionBlocked)
  - Quarantine a specific tool for this instance (isToolQuarantined)
  - Operator-blocked egress domains (isOperatorBlocked)
  - Per-session rate-limit overrides (getSessionRateLimit)
- All suspension events appended to data/logs/labyrinth-suspend.log.
- One-way trust: Scout controls Carina, not vice versa.

#### Pairing: Connecting Carina to Scout
Five env vars on the Carina side:
```
LABYRINTH_ENABLED=true
LABYRINTH_URL=<tenant console URL>
LABYRINTH_API_KEY=lscout_...
LABYRINTH_INSTANCE_ID=carina-{hostname}
LABYRINTH_INSTANCE_NAME=Carina ({hostname})
```

Two ways to populate them:
1. First-run setup wizard: after choosing LLM provider, wizard asks "Connect to Labyrinth Scout?" and populates .env.
2. Ops settings panel: POST /settings/scout-pairing writes SCOUT_API_KEY into ops env.

#### ops.carinaai.uk: The Shared Control Room
```
ops.carinaai.uk  --[fetch http://localhost:3333/api/...]-->  Carina agent
ops.carinaai.uk  --[scoutGet() -> http://localhost:4444/api/...]-->  Scout console
```
A thin Express/EJS panel (password-gated, VERLOX only) that proxies into both products rather than re-implementing anything.

#### IDE Extensions
```
IDE client  ->  extensions/carina-ide | carina-jetbrains  ->  POST {CARINA_URL}/acp/ide/chat
                                                         ->  GET  {CARINA_URL}/acp/ide/capabilities
                                                         ->  GET  {CARINA_URL}/acp/tools
```
- VS Code / Cursor / Zed: TypeScript VSIX packages.
- JetBrains (IDEA, WebStorm, PyCharm): Java Gradle plugin ZIP.

---

## 3. Carina Core (core.carinaai.uk)

The monorepo's heart. 760 TypeScript source files across 49 directories. 406 test files. Node >=22, TypeScript 6.0+.

Package version: @verlox/carina-core v0.2.0 (MIT).

### 3.1 Source Directory Breakdown

| Directory | Files | Purpose |
|-----------|-------|---------|
| agents/ | 42 | Main agent loop (carina.ts), orchestrator, sub-agents, tool runner, trajectory tracking, delegation, provider capabilities, check-in, cron scheduling, kanban workflows |
| api/ | 31 | HTTP API: billing, calendar, carina ops, compare, control, playbook, curator, email webhooks, hosted (auth/billing/migrations/push/scout/web), kanban, memory, observability, ops, packs, pairing, process, research, subscribe, tenant keys, theme, webhook, cloud router/store/migrations |
| billing/ | 18 | Stripe integration, credit gate/ledger, invoice generation, margin reports, ops metering, plans, rate cards, reconciliation, scout provisioning, workspace billing, Stripe webhooks |
| brain/ | 16 | LLM abstraction layer: messages, cost tracker, credential pool, provider catalog/registry/routing/proxy/health/capabilities/tags, tenant provider keys, OpenAI-compatible adapters, prompt cache, task classifier, request timeout, latency guard |
| benchmark/ | 6 | Agent benchmarking framework: type definitions, benchmark definitions, runner, scorer, report generation, competitor baselines |
| cli/ | 97 | CLI registry, provider bootstrap, first-run/onboarding, completion metadata, local session handling, 58 CLI commands |
| capabilities/ | 1 | Audit capability declarations |
| certification/ | 1 | "Built on Carina" certification |
| commitments/ | 6 | Agent commitment tracking |
| config/ | 3 | Configuration loading, .env processing |
| cookbook/ | 8 | Internal hardware/model catalog used by Playbook |
| credentials/ | 7 | Credential vault, encryption, rotation |
| enterprise/ | 1 | Enterprise kernel support |
| extensions/ | 18 | Extension/plugin system |
| gateway/ | 98 | Channel bootstrap, web auth/context/chat, hosted scout/chat, notes API, documents API/assist, images API/sync, email API/store, SMTP sender, IMAP fetcher, IRC, extra channels, ACP/IDE/compliance, channel registry/routing/capabilities/status, catalog specs, thread ownership, stub channels, 44 channel adapters |
| host/ | 1 | Platform detection |
| hosted/ | 27 | Multi-tenant cloud: org management, RBAC, quotas, isolation, plan gates, scoped queries, migrations |
| infrastructure/ | 27 | PTY, WebSocket server/transport, ACP bridge, migrations |
| integration/ | 2 | CalDAV client |
| integrations/ | 1 | Additional integrations entry point |
| lib/ | 2 | Shared utilities |
| lsp/ | 1 | Language Server Protocol integration |
| mcp/ | 11 | MCP client (HTTP + stdio) |
| memory/ | 28 | Persistent memory, embeddings, session scroll, session index, session search, 5 backends (builtin, SQLite, Postgres, Mem0, Honcho), REM promotion |
| notifications/ | 3 | Scout push poller |
| ops/ | 41 | Secrets plan, gateway token, observability (gateway logs, system events, session overview), taskflow parser, health deep scan, migrations |
| pairing/ | 1 | Device pairing |
| platform/ | 1 | Platform knowledge |
| plugins/ | 4 | Utility plugins, GitHub Copilot provider plugin |
| product/ | 5 | Product-specific configurations |
| profiles/ | 8 | Dev isolation/isolation persistence, scope |
| providers/ | 1 | External CLI provider support |
| public-api/ | 6 | Public API: tool, memory, provider, channel, pack |
| research/ | 1 | Research store |
| sandbox/ | 6 | Sandbox factory: Docker sandbox/runner/availability, worker sandbox, openshell sandbox |
| security/ | 30 | Prompt guard (with middleware), tool policy/RBAC/risk/execution context, tool sequence guard, approval policy, JIT credentials (with middleware), honeypot client, deception client, egress filter, kill switch listener, scout client/context, shield report, agent guard adapter, injection patterns JSON |
| setup/ | 3 | First-run setup wizard |
| skills/ | 81 | Skill store, pack loader, skill MD loader, ingestion, curator/scheduler, writer, auto-writer, session learner, user resources, Hub (server, registry, seed, build pack, validate, client, migrations), 16 domain packs |
| sync/ | 1 | Sync utilities |
| telemetry/ | 1 | Telemetry |
| tools/ | 79 | Tool registry, 53+ tools, toolset config, integrations (Discord, Feishu, HomeAssistant, X), browser tools, sandbox, LSP, MCP |
| tui/ | 8 | Terminal UI |
| types/ | 4 | Shared types |
| utils/ | 2 | Shared utilities |
| webhooks/ | 6 | Webhook handling |
| windows/ | 2 | Windows-specific support |
| workspace/ | 3 | Workspace management |
| workspaces/ | 8 | Multi-workspace support |

### 3.2 Agent System

The agent architecture is a hierarchical orchestration model:

- **Main Loop** (carina.ts): The top-level agent loop that receives user requests, delegates to the orchestrator, and manages the overall session lifecycle.
- **Orchestrator** (orchestrator.ts): Breaks complex tasks into sub-tasks, determines tool requirements, and spawns sub-agents.
- **Sub-Agent System**: Specialized agents for coding, communication, research, and file operations. Each sub-agent has its own tool set, system prompt, and delegation context.
  - generic-sub-agent.ts: Default fallback for general tasks.
  - coding-agent.ts: Code generation, debugging, and refactoring.
  - communication-agent.ts: Message composition, email drafting.
  - research-agent.ts: Web research, data gathering, deep research via deep-research.ts.
  - file-agent.ts: File system operations, document processing.
- **Tool Runner** (tool-runner.ts): Executes tool calls with security checks, rate limiting, and error handling.
- **Trajectory System**: Records agent decision paths (trajectory.ts, trajectory-config.ts, trajectory-summarize.ts) for debugging and learning.
- **Delegation Context**: Controls what sub-agents can access (delegation-context.ts).
- **Provider Capabilities**: Dynamic detection of what each LLM provider supports (provider-capabilities.ts).
- **Check-In System** (check-in.ts): Periodic agent self-checks and status reporting.
- **Scheduled Tasks / Cron** (scheduled-tasks.ts, cron-scheduler.ts, cron-delivery.ts, cron-delivery-registry.ts, cron-step-runner.ts, cron-workdir.ts, cron-workflow-engine/parser/scheduler/store/types.ts): Time-based task execution with workflow support.
- **Kanban** (kanban-store.ts, kanban-service.ts, kanban-persistence.ts, kanban-types.ts, kanban-workflow.ts): Visual task management integrated into agent workflows.
- **Checks**: Pre-built check modules for email (email-check.ts), project status (project-status-check.ts), weather (weather-check.ts).

### 3.3 Memory System

Five pluggable backends with a unified API:

| Backend | File | Use Case |
|---------|------|----------|
| Builtin | builtin-backend.ts | In-process memory for single-instance use; zero configuration |
| SQLite | sqlite-backend.ts | Local persistence for single-machine deployments |
| PostgreSQL + pgvector | postgres-backend.ts | Production multi-tenant with vector search |
| Mem0 | mem0-backend.ts | Cloud-hosted memory service with semantic capabilities |
| Honcho | honcho-backend.ts | Open-source agent memory platform |

Features:
- Persistent memory (persistent-memory.ts): Long-term storage across sessions.
- Embeddings (embeddings.ts): Vector representations for semantic search.
- Session scroll (session-scroll.ts): Maintains conversation context window.
- Session index (session-index.ts): Full-text and semantic search across session history.
- REM promotion (rem/rem-promotion.ts): Automatically promotes important facts to long-term memory.
- Memory reindexing: Rebuild semantic indexes.

### 3.4 Gateway and Channels

The gateway system (98 files) provides a unified abstraction for all communication channels.

**Channel Registry** (channel-registry.ts): Central registration of all channel adapters with capability detection, status tracking, and routing.

**Channel Adapters** (44 files in core; 18 in public npm):

Core adapters include: API Server, DingTalk, Discord, Email, Feishu Chat, Google Chat, Gotify, GroupMe, HomeAssistant, iMessage, Instagram, IRC, KakaoTalk, Keybase, LINE, LinkedIn, Matrix, Mattermost, Messenger, Nextcloud Talk, ntfy, Pushover, REST helpers, RocketChat, Signal, Slack, SMS, Teams, Telegram, Threema, Twitch, Twitter/X, Web, Webex, Webhook, WeChat, WhatsApp, Wire, YouTube, Zalo, and more.

Public npm adapters (18): API Server, DingTalk, Discord, Email, Feishu Chat, HomeAssistant, iMessage, Matrix, Mattermost, REST helpers, Signal, Slack, SMS, Telegram, Web, Webhook, WeChat, WhatsApp.

Features:
- Web auth (web-auth.ts) and web context (web-context.ts) for browser-based sessions.
- Web chat turn handling (web-chat-turn.ts).
- Hosted chat/scout support for multi-tenant deployments.
- Notes API (notes-api.ts): Note-taking across channels.
- Documents API (documents-api.ts, documents-assist.ts): Document processing and assistance.
- Images API (images-api.ts, images-sync.ts): Image handling and sync.
- Email integration (email-api.ts, email-store.ts, smtp-sender.ts, imap-fetcher.ts): Full email capabilities.
- IRC support (irc.ts).
- ACP (Agent Communication Protocol): IDE integration (acp.ts, acp-ide.ts, acp-compliance.ts).
- Channel routing, capability detection, status tracking, thread ownership.
- Stub channels for testing.

### 3.5 Model Routing (Brain)

The brain/ directory (16 files) manages all LLM interactions:

- **Provider Catalog** (provider-catalog.ts): Lists all 51 registered providers with display names, auth types, cost tags, status, health, and capabilities.
- **Provider Registry** (provider-registry.ts): Central definition of all providers with API key env vars, model env vars, base URLs, default models, capabilities (chat/vision/streaming/tools/reasoning/embeddings), cost per token, fallback priority, status (active/experimental/alias/external-cli/oauth/unsupported).
- **Provider Routing** (provider-routing.ts): Intelligent routing to the best available provider based on cost, speed, capabilities, and health.
- **Provider Proxy Routing** (provider-proxy-routing.ts): Routes through proxy/gateway when configured.
- **Provider Health** (provider-health.ts): Health checks and availability monitoring.
- **Provider Capability Detection** (provider-capability-detection.ts): Runtime detection of provider features.
- **Provider Tags** (provider-tags.ts): Tagging for cost tier, speed, chat, code, vision, long context, tool use.
- **Tenant Provider Keys** (tenant-provider-keys.ts): BYOK (Bring Your Own Key) support with AES-256-CBC encryption.
- **OpenAI-Compatible Provider** (openai-compatible-provider.ts): Generic adapter for any OpenAI-compatible endpoint.
- **Prompt Cache** (prompt-cache.ts): Caching for reduced latency and cost.
- **Task Classifier** (task-classifier.ts): Routes tasks to appropriate models based on complexity.
- **Request Timeout** (request-timeout.ts): Configurable timeouts per provider.
- **Provider Latency Guard** (provider-latency-guard.ts): Adaptive latency thresholds.
- **Credential Pool** (credential-pool.ts): Multi-key rotation for high-throughput.
- **Cost Tracker** (cost-tracker.ts): Token usage and cost tracking.
- **Messages** (messages.ts): Message formatting and conversion between provider formats.

### 3.6 Security Layer

30 security files in core.carinaai.uk/src/security/:

- **Prompt Guard** (prompt-guard.ts, prompt-guard-middleware.ts): Injection detection and blocking using injection-patterns.json with hundreds of known attack patterns.
- **Tool Policy** (tool-policy.ts, tool-policy-middleware.ts): Policy-based tool access control with risk scoring.
- **Tool RBAC** (tool-rbac.ts): Role-based access control for tools.
- **Tool Risk** (tool-risk.ts): Risk assessment for each tool invocation.
- **Tool Execution Context** (tool-execution-context.ts): Context tracking for security decisions.
- **Tool Sequence Guard** (tool-sequence-guard.ts, tool-sequence-middleware.ts): Detects dangerous sequences of tool calls.
- **Approval Policy** (approval-policy.ts): Human-in-the-loop approval for high-risk actions.
- **JIT Credentials** (jit-credentials.ts, jit-credentials-middleware.ts): Just-in-time credentials scoped to a single session, never persisted.
- **Honeypot Client** (honeypot-client.ts): Decoy injection to detect attackers.
- **Deception Client** (deception-client.ts): Active deception techniques.
- **Egress Filter** (egress-filter.ts): Controls what domains tools can reach.
- **Kill Switch Listener** (kill-switch-listener.ts): Listens for Scout control commands via Redis.
- **Scout Client** (scout-client.ts): Batches and sends security events to Scout console.
- **Scout Context** (scout-context.ts): Per-tenant scoping for hosted deployments.
- **Shield Report** (shield-report.ts): Generates security posture reports.
- **Agent Guard Adapter** (agent-guard-adapter.ts): Adapter for external security systems.
- **Injection Patterns** (injection-patterns.json): Curated database of known prompt injection patterns.

### 3.7 Billing System

18 billing files:

- **Stripe Service** (stripe-service.ts): Core Stripe integration.
- **Subscription Manager** (subscription-manager.ts): Plan provisioning and lifecycle.
- **Billing API** (billing-api.ts): HTTP endpoints for billing operations.
- **Credit Gate** (credit-gate.ts): Usage enforcement before API calls.
- **Credit Ledger** (credit-ledger.ts): Immutable credit transaction log.
- **Invoice Generator** (invoice-generator.ts): PDF invoice generation.
- **Margin Report** (margin-report.ts): VERLOX profit analysis.
- **Ops Metering** (ops-metering-service.ts): Usage-based metering for ops.
- **Plans** (plans.ts): Plan definitions and feature gates.
- **Rate Card** (rate-card.ts): Per-provider pricing configuration.
- **Reconciliation** (reconciliation-job.ts, reconciliation-scheduler.ts): Payment/usage reconciliation.
- **Scout Provisioning** (scout-provisioning.ts): Auto-provisions Scout on payment.
- **Scout Welcome Email** (scout-welcome-email.ts): Onboarding email on Scout subscription.
- **Tenant Scout** (tenant-scout.ts): Per-tenant Scout integration.
- **Usage Meter** (usage-meter.ts): Token and cost tracking.
- **Workspace Billing** (workspace-billing.ts): Team/workspace billing.
- **Stripe Webhook** (webhooks/stripe-webhook.ts): Processes Stripe events.

### 3.8 CLI (58 Commands)

The carina CLI provides 58 commands organized under:

| Category | Commands |
|----------|----------|
| agent | Start, stop, status, session management |
| setup | First-run setup, provider bootstrap, onboarding |
| model | Provider management, model selection, interactive model picker |
| serve | Run as server/daemon |
| agents | Multi-agent orchestration |
| providers | List, configure, test providers |
| sessions | Session management and history |
| checkpoint | Save/restore agent state |
| backup | Backup/restore configuration |
| security | Security configuration, Scout pairing |
| scout | Scout integration commands |
| credentials | Credential vault management |
| secrets | Secret management |
| packs | Domain pack installation and management |
| skills | Skill management |
| ingest | Data ingestion for RAG |
| rag | RAG pipeline management |
| memory | Memory backend configuration |
| contacts | Contact management |
| config | Configuration management |
| env | Environment variable management |
| gateway | Gateway/channel configuration |
| channels | Channel management (including WhatsApp) |
| whatsapp | WhatsApp-specific setup |
| tools | Tool management |
| plugins | Plugin installation and management |
| hooks | Lifecycle hooks |
| update | Self-update |
| doctor | System health check |
| completion | Shell completion generation |
| billing | Billing management |
| tenant | Tenant management |
| ops | Operations commands |
| ide | IDE extension installation (vscode, cursor, zed, jetbrains, all) |
| host | Host detection |
| pairing | Device pairing |
| profile | Agent profile management |
| hub | Carina Hub interactions |
| commitments | Agent commitment tracking |
| personality | Agent personality configuration |
| logs | Log viewing and management |
| cron | Cron job management |

### 3.9 Skills and Domain Packs

81 files in skills/ directory. 16 domain packs:

| Pack | Directory | Domain |
|------|-----------|--------|
| property-uk | skills/packs/property-uk/ | UK property law, conveyancing, tenancy, valuation |
| legal-uk | skills/packs/legal-uk/ | UK legal research, case law, legislation |
| finance | skills/packs/finance/ | Financial analysis, investment, accounting |
| data-science | skills/packs/data-science/ | Statistical analysis, ML workflows, data viz |
| core-engineering | skills/packs/core-engineering/ | Software engineering, system design, code review |
| devops | skills/packs/devops/ | CI/CD, infrastructure, cloud, containers |
| mlops | skills/packs/mlops/ | ML deployment, model monitoring, pipelines |
| media-extended | skills/packs/media-extended/ | Audio/video processing, media production |
| creative-basics | skills/packs/creative-basics/ | Writing, design, creative workflows |
| social-extended | skills/packs/social-extended/ | Social media management, content strategy |
| email-extended | skills/packs/email-extended/ | Advanced email workflows, campaigns |
| smart-home | skills/packs/smart-home/ | Home automation, IoT, HomeAssistant |
| healthcare | skills/packs/healthcare/ | Medical knowledge, clinical workflows |
| productivity | skills/packs/productivity/ | Task management, workflows, automation |
| research-basics | skills/packs/research-basics/ | Academic research, literature review |
| sales-crm | skills/packs/sales-crm/ | Sales workflows, CRM integration |

Skill system features:
- **Curator** (curator.ts, curator-scheduler.ts): Automatically discovers and organizes skills.
- **Writer** (writer.ts): Authoring tools for skill creation.
- **Auto-Writer** (auto-writer.ts): Self-improving skill generation from agent experiences.
- **Session Learner** (session-learner.ts): Extracts reusable knowledge from conversations.
- **User Resources** (user-resources.ts): User-provided skill materials.
- **Hub** (hub/server.ts, hub/registry.ts, hub/seed.ts, hub/build-pack.ts, hub/validate.ts, hub/hub-client.ts, hub/migrations.ts): Community skill discovery and distribution.
- Learning loop: quality-gated refinement, never-deletes archival.

### 3.10 Additional Core Modules

- **Benchmark** (benchmark/): Agent benchmarking with types, definitions, runner, scorer, reports, and competitor baselines.
- **Capabilities** (capabilities/): Audit capability declarations for compliance.
- **Certification** (certification/): "Built on Carina" certification program.
- **Commitments** (commitments/): Agent commitment tracking for accountability.
- **Playbook** (workspace `/playbook`, CLI `carina playbook`): Hardware-aware model discovery and serve guidance. Internal hardware catalog lives in `cookbook/`.
- **Credentials** (credentials/): Encrypted credential vault with rotation.
- **Enterprise** (enterprise/): Enterprise kernel support.
- **Extensions** (extensions/): Extension/plugin system for third-party add-ons.
- **Host** (host/): Platform detection (Linux, macOS, Windows).
- **Hosted** (hosted/): Multi-tenant cloud platform with org management, RBAC, quotas, isolation, plan gates, scoped queries.
- **Infrastructure** (infrastructure/): PTY support, WebSocket server/transport, ACP bridge, migrations.
- **Integrations** (integration/): CalDAV client for calendar integration.
- **LSP** (lsp/): Language Server Protocol integration for code intelligence.
- **MCP** (mcp/): Model Context Protocol client (HTTP + stdio) and server support.
- **Notifications** (notifications/): Scout push poller for real-time alerts.
- **Ops** (ops/): Secrets plan, gateway token, observability (gateway logs, system events, session overview), taskflow parser, health deep scan.
- **Pairing** (pairing/): Device pairing for mobile/remote access.
- **Platform** (platform/): Platform knowledge base.
- **Plugins** (plugins/): Utility plugins, GitHub Copilot provider plugin.
- **Profiles** (profiles/): Dev isolation for multi-profile environments.
- **Public API** (public-api/): Stable public API for tool, memory, provider, channel, pack.
- **Research** (research/): Research store for deep research results.
- **Sandbox** (sandbox/): Docker sandbox/runner/availability, worker sandbox, openshell sandbox for safe execution.
- **TUI** (tui/): Terminal user interface.
- **Workspaces** (workspaces/, workspace/): Multi-workspace support with isolation.

---

## 4. Carina Agent Public Package (npm)

Published as `carina-agent` v0.1.1 on npm. Approximately 400 files. This is what users install with `npm install -g carina-agent`.

### 4.1 Public Package Modules

| Directory | Files | Purpose |
|-----------|-------|---------|
| agents/ | 25 | Main agent loop, orchestrator, sub-agents, tool runner, trajectory, delegation, cron, kanban |
| api/ | 16 | Public API routes |
| billing/ | 9 | Stripe billing, metering |
| brain/ | 10 | LLM, messages, providers, task classifier, cost tracker, prompt cache |
| cli/ | 55 | CLI commands (58 commands) |
| commitments/ | 6 | Agent commitment tracking |
| config/ | 3 | Configuration loading |
| credentials/ | 7 | Credential vault |
| gateway/ | 46 | Channel registry (18 adapters), channel routing |
| infrastructure/ | 4 | Pairing, host detection, control auth |
| lsp/ | 1 | LSP integration |
| mcp/ | 4 | MCP client |
| memory/ | 20 | Memory store, backends (5), embeddings, session index, REM |
| notifications/ | 3 | Push notifications |
| ops/ | 8 | Operations utilities |
| plugins/ | 1 | Plugin system |
| profiles/ | 3 | Profile management |
| security/ | 17 | Prompt guard, tool policy, JIT credentials, kill switch, honeypot, deception, egress filter, scout client |
| setup/ | 3 | Setup wizard |
| skills/ | 37 | Skill store, pack loader, curator, writer, auto-writer, 16 domain packs, Hub |
| sync/ | 1 | Sync utilities |
| tools/ | 57 | 53+ tools, toolset config, browser tools, integrations, sandbox |
| tui/ | 1 | Terminal UI |
| types/ | 3 | Shared types |
| utils/ | 2 | Utilities |
| webhooks/ | 2 | Webhook handling |
| workspace/ | 3 | Workspace management |
| workspaces/ | 7 | Multi-workspace |

### 4.2 16 Domain Packs (Public)

Same 16 packs as core (property-uk, legal-uk, finance, data-science, core-engineering, devops, mlops, media-extended, creative-basics, social-extended, email-extended, smart-home, healthcare, productivity, research-basics, sales-crm).

### 4.3 Brain Knowledge (~200 Markdown Files)

Extensive UK property knowledge covering: conveyancing, tenancy law, property valuation, mortgage processes, land registry, planning permission, property taxation, leasehold/freehold law, building regulations, and more.

### 4.4 CI/CD

GitHub Actions:
- public-repo/ci.yml: Continuous integration (build, test, typecheck).
- public-repo/publish.yml: Automated npm publishing.

---

## 5. Carina Cloud / Hosted SaaS (app.carinaai.uk)

A Next.js 15 application providing the hosted SaaS experience.

### 5.1 App Router Pages

| Route | Purpose |
|-------|---------|
| /login | User authentication |
| /register | Account creation |
| /dashboard | Main user dashboard (hosted chat UI) |
| /admin | Admin panel |
| /settings | BYOK provider keys |
| /billing | Stripe Checkout / Portal |
| /billing/checkout | Payment flow |
| /security | Scout hub (Pro): key, instances, events |
| /dashboard (scout) | Tenant-scoped Scout dashboard (Pro) |

### 5.2 API Routes

| Route | Purpose |
|-------|---------|
| /api/auth/[...all] | Authentication (register, login, session) |
| /api/chat | Chat API |
| /api/webhooks/stripe | Stripe webhook receiver |
| /app/auth/scout/status | JSON status for security page |
| /app/auth/scout/key | Full scout_live_* key (Pro, session auth) |

### 5.3 Hosted Architecture

Enabled with HOSTED_MODE=true. Serves app.carinaai.uk (set CARINA_HOSTED_APP_HOST).

**Host-Aware Auth:**
- Operator hosts (CARINA_OPERATOR_HOSTS): single shared password (CARINA_WEB_PASSWORD).
- Hosted app host (app.carinaai.uk): per-tenant session (hostedAccountId), register/login.

**Tenant Data Model (Postgres carina_central):**

| Table | Purpose |
|-------|---------|
| hosted_users | Account, tier, daily quota, api_key, schema_name |
| subscriptions | Stripe plan, scout_api_key, status |
| usage_records | Monthly tokens/cost per tenant |
| tenant_provider_keys | Encrypted BYOK credentials |
| invoices, stripe_events | Billing audit |

Each user gets an isolated Postgres schema for memories/skills.

**Scout Provisioning on Payment:**
Stripe webhook -> subscription-manager.syncFromCheckoutSession() -> issues scout_live_* -> provisionScoutTenant() POSTs to Scout:
```
POST {LABYRINTH_URL}/api/internal/provision-tenant
X-Scout-Provision-Secret: {SCOUT_PROVISION_SECRET}
{ email, carinaTenantId, licenseKey }
```

Scout creates/links accounts row (carina_tenant_id) and registers the license. Tenant keys authenticate like lsk_* keys but are scoped to one account.

**Per-Tenant Scout Reporting:**
Pro hosted chat wraps requests in scoutContext: events use tenant's scout_live_* key and instance hosted:{userId}. Does not require global LABYRINTH_ENABLED if LABYRINTH_URL is set.

### 5.4 Next.js Configuration

- output: standalone (optimized Docker deployment)
- 47 source files (TypeScript/TSX)
- Built locally, rsynced to production

---

## 6. Carina Ops Dashboard (ops.carinaai.uk)

Private VERLOX operations panel. Password-gated. Never shipped to customers.

### 6.1 Route Modules (15)

| Route File | Purpose |
|------------|---------|
| auth.ts | Authentication |
| dashboard.ts | Main overview |
| chat.ts | Chat monitoring |
| security.ts | Security configuration |
| memories.ts | Memory management |
| skills.ts | Skill management |
| rag.ts | RAG pipeline management |
| packs.ts | Domain pack management |
| projects.ts | Project management |
| tenants.ts | Tenant administration |
| subscriptions.ts | Subscription management |
| settings.ts | System settings, Scout pairing, connectivity tests |
| operator.ts | Operator utilities |
| ai-platform.ts | AI platform (agents, sessions, skills, files, batches, deployments, environments, vaults, memory, analytics, credits, workbench, margins) |
| channels.ts | Channel status and management |

### 6.2 Library Modules (30 files)

Key libraries:
- carina.ts: Carina API client for ops -> core communication.
- carina-pairing.ts: Device/instance pairing logic.
- tenants.ts, tenant-provisioning.ts, tenant-audit.ts, tenant-packs.ts, tenant-byok.ts: Tenant management.
- hosted-migrations.ts: Hosted platform migrations.
- billing-plans.ts: Billing plan management.
- packs.ts: Pack management.
- projects.ts: Project management.
- scout.ts: Scout console API client.
- ai-platform.ts: AI platform integration.
- support-impersonation.ts: Support staff tenant impersonation.
- core-env.ts: Core environment variable management.
- channel-status.ts: Channel health monitoring.
- db.ts, env.ts, constants.ts, list-sort.ts: Shared utilities.

### 6.3 EJS View Templates (19)

Templates for: auth, dashboard, chat, security, memories, skills, rag, packs, projects, tenants, subscriptions, settings, operator, ai-platform, channels, and more.

### 6.4 Settings Tab Responsibilities

- Test Carina / Test Scout connectivity (POST /settings/test-carina, /settings/test-scout).
- Change Scout console HTTP Basic Auth password (POST /settings/scout-password).
- Pair Carina instance with Scout account (POST /settings/scout-pairing).
- Read-only environment summary with masked secrets.

### 6.5 Ops Tenant Admin (VERLOX only)

- List tenants with tier, daily messages, BYOK count, monthly tokens.
- Detail view: subscription, masked API key, Scout providers, usage records.
- Actions: set tier, reset daily quota.

### 6.6 Cross-Platform Session Unification

CARINA_OPERATOR_SESSION environment variable enables unified session tracking across the platform.

---

## 7. Carina Mobile (carinaMobile)

Expo Router-based React Native application. 121 source files.

### 7.1 App Pages

| Route | Purpose |
|-------|---------|
| _layout | Root layout |
| (auth)/login | Authentication |
| (auth)/onboarding | First-run onboarding |
| (tabs)/chat | Chat interface |
| (tabs)/tasks | Task management |
| (tabs)/trust | Trust dashboard |
| (tabs)/more | Settings and more |
| instance | Carina instance management |
| packs | Domain pack browsing |
| memory | Memory management |
| usage | Usage and billing |

### 7.2 API Client (6 files)

| File | Purpose |
|------|---------|
| carina-client.ts | Main Carina API client |
| chat-stream.ts | SSE chat streaming |
| packs-client.ts | Pack management API |
| scout-trust.ts | Scout trust dashboard |
| scout-hosted.ts | Scout hosted integration |
| push-client.ts | Push notification client |
| memory-client.ts | Memory API |
| billing-client.ts | Billing API |

### 7.3 Hooks (23)

useCarinaConfig, useChatSession, useChatStream, useDeepLinks, useTrustDashboard, usePushRegistration, useAppLock, useOfflineQueue, useVoiceInput, useCloudFeatureAccess, useConnectionStatus, useMemories, usePacks, useTasks, useNativeCapabilities, useSessionActions, useNotificationPrefs, useSessionIndex, useNotificationSetup, useScoutAlertMonitor, useBilling, and more.

### 7.4 Components (24)

ChatMessageBubble, ChatComposer, SessionDrawer, SessionRenameModal, TaskCard, MemoryCard, MemoryEditModal, PackCard, TrustMetricsGrid, TrustScoreCard, KillSwitchPanel, SecurityEventCard, ProviderBadge, ProviderPicker, CommandPalette, SuggestedPrompts, ToolActivityStrip, ScoutStatusChip, ConnectionStatusChip, CarinaLogo, CloudFeatureGate, AppLockOverlay, OfflineQueueBanner, ScreenShell.

### 7.5 Stores (4)

instance-store, api-key-store, auth-store, app-lock-store.

### 7.6 Widgets

TaskCountWidget (home screen widget), register-widget.

### 7.7 Theme

tokens.ts: VERLOX design system tokens (teal #0d9488 primary).

### 7.8 Test Coverage

10+ test files (Vitest for mobile config and API helpers).

---

## 8. Carina IDE Extensions

Two editor extensions connecting IDEs to a running Carina gateway.

### 8.1 Carina IDE (VS Code / Cursor / Zed)

Location: extensions/carina-ide/

Technologies: TypeScript, VS Code Extension API.

Features:
- Chat tool window with SSE streaming from Carina.
- Ask-about-selection (right-click -> Ask Carina).
- Tool listing and capability inspection.
- Connection health check.
- Provider/model switching.
- Pack management.

Build and install: `carina ide build` or `carina ide install [vscode|cursor|zed|all]`.
Format: VSIX packages.

Key files:
- extension.ts: Extension entry point and activation.
- carinaClient.ts: HTTP/SSE client for Carina gateway.
- chatViewProvider.ts: Webview-based chat panel.

### 8.2 Carina JetBrains (IntelliJ, WebStorm, PyCharm, etc.)

Location: extensions/carina-jetbrains/

Technologies: Java, Gradle, IntelliJ Platform SDK.

Features:
- Tool window with chat panel.
- Chat service for SSE streaming.
- Settings UI for provider/model configuration.
- Connection management.

Build and install: Settings > Plugins > Install Plugin from Disk > carina-jetbrains-0.1.0.zip.
Format: Gradle plugin ZIP.

Key files (10 Java files):
- Tool window factory, chat panel, chat service, HTTP client, settings.

### 8.3 IDE Connection Flow

```
IDE client  ->  extensions  ->  POST {CARINA_URL}/acp/ide/chat
                            ->  GET  {CARINA_URL}/acp/ide/capabilities
                            ->  GET  {CARINA_URL}/acp/tools
```

Requires a running Carina gateway (`carina web` or `carina serve`, default port 3000).

---

## 9. Carina Hub (Skill Discovery)

Community skill pack discovery and distribution platform.

Location: core.carinaai.uk/src/skills/hub/ and hub.carinaai.uk/

### 9.1 Hub Server Components

| File | Purpose |
|------|---------|
| hub/server.ts | Hub API server |
| hub/registry.ts | Pack registry with metadata |
| hub/seed.ts | Seed data for initial packs |
| hub/build-pack.ts | Pack build and packaging |
| hub/validate.ts | Pack validation against schema |
| hub/hub-client.ts | Client for hub interactions |
| hub/migrations.ts | Hub database migrations |

### 9.2 Hub Features

- Pack discovery and installation.
- Version management.
- Community ratings and reviews.
- Auto-curation and quality scoring.
- Integration with `carina pack install <name>` CLI.

### 9.3 Hub Website

Static site at hub.carinaai.uk for browsing available packs.

---

## 10. Carina Docs Site (docs.carinaai.uk)

Docusaurus-based documentation site.

### 10.1 Content Areas

- **User Guide**: Getting started, chat, channels, memory, packs.
- **Developer Guide**: Building domain packs, contributing, API reference, MCP integration, university program.
- **Carina Cloud Guide**: Tenant documentation for hosted SaaS.
- **Operator Guide**: Scout setup, security configuration.

### 10.2 Shared CSS

Three CSS files in shared/docs-ui/:
- vitepress.css: VitePress theme (legacy).
- docusaurus.css: Docusaurus theme (active).
- tokens.css: VERLOX brand design tokens (teal #0d9488 primary color).

### 10.3 University Program

Documented at carinaai.uk/docs/developer/university-program. Carina is free for coursework, research, and dissertations under MIT license.

---

## 11. Carina Marketing Site (carinaai.uk)

Static HTML/CSS/vanilla-JS site. No backend.

### 11.1 Sections

- Home page with product overview.
- /trust: Public trust dashboard (fetches from Scout public trust API).
- /cloud: Carina Cloud signup.
- /enterprise: Enterprise offering.
- /skill-packs: Pack catalog.
- /docs: Links to documentation.
- Subscribe form: POST https://carinaai.uk/api/subscribe (with localStorage fallback).

### 11.2 Deployment

- Plain rsync of static files to /www/wwwroot/carinaai.uk/.
- Nginx serves directly (no Node process, no supervisor).
- Extensionless URLs via nginx.clean-urls.conf and .htaccess.

---

## 12. Labyrinth Scout Console (console.labyrinthscout.com)

The commercial security monitoring platform. 181 source files. 146 test files. 50+ API endpoints.

### 12.1 Module Breakdown

#### Server Core
| File | Purpose |
|------|---------|
| server.ts | Express server entry point |
| cli.ts | CLI interface |
| db.ts | SQLite/Postgres database |
| redis.ts | Redis pub/sub for kill switch |
| scheduler.ts | Cron job scheduler |
| migrations.ts | Database schema migrations |
| types.ts | Shared type definitions |
| config/index.ts | Configuration loading |

#### Dashboard (19 widget JS files)
dashboard.html (3127 lines) + widget modules:
| Widget | Purpose |
|--------|---------|
| charts.js | Event and metric charts |
| events-table.js | Live event feed |
| alerts-feed.js | Alert stream |
| risk-gauge.js | Real-time risk visualization |
| kill-switch.js | Kill switch control panel |
| threat-timeline.js | Chronological threat view |
| session-map.js | Geographic session mapping |
| tool-heatmap.js | Tool usage intensity |
| egress-monitor.js | Egress traffic monitor |
| honeypot-monitor.js | Honeypot detection tracking |
| compliance-score.js | Compliance posture score |
| trust-score.js | Blockchain trust score |
| attestation-timeline.js | Attestation history |
| instance-status.js | Instance health |
| audit-log.js | Audit trail viewer |
| model-usage.js | LLM usage analytics |
| channel-map.js | Channel distribution |
| approval-queue.js | Pending approvals |
| theme.js | Dashboard theming |

Additional server-side dashboard widgets:
| Widget File | Purpose |
|-------------|---------|
| defense-console.ts | Integrated defense operations |
| agent-status.ts | Agent status overview |
| incident-ops.ts | Incident management |
| posture-summary.ts | Security posture summary |
| response-terminal.ts | Operator response terminal |
| fleet-summary.ts | Multi-instance fleet view |
| usage-analytics.ts | Usage pattern analysis |
| threat-metrics.ts | Threat metric aggregation |

#### Security (25 files)

| Module | Purpose |
|--------|---------|
| anomaly-detector.ts | ML-based anomaly detection with anomaly types |
| egress-filter.ts | Egress traffic filtering |
| prompt-guard.ts | Prompt injection detection |
| token-bucket.ts | Rate limiting |
| tool-policy.ts | Tool access policies |
| tool-tiers.ts | Tool risk tiering |
| risk-registry.ts | Risk scoring and registration |
| risk-transitions.ts | Risk state machine |
| auto-remediation.ts | Automated threat response |
| action-simulator.ts | Attack simulation |
| attack-surface.ts | Attack surface analysis |
| context-firewall.ts | Context-level firewall |
| forensic-snapshot.ts | Forensic capture |
| honeypot-manager.ts | Honeypot deployment |
| honeypot-prompt-block.ts | Honeypot prompt injection blocking |
| jit-privileges.ts | Just-in-time privilege escalation |
| policy-decisions.ts | Policy decision engine |
| policy-gateway.ts | Policy enforcement gateway |
| policy-packs.ts | Bundled policy templates |
| session-shield.ts | Per-session security shield |
| shield-report.ts | Security posture report |
| tripwire-registry.ts | Tripwire definitions |

#### Deception (5 files)

| Module | Purpose |
|--------|---------|
| decoy-generator.ts | Generates deceptive decoys |
| honeypot-manager.ts | Manages honeypot instances |
| moving-target.ts | Moving target defense rotation |
| rotation-scheduler.ts | Schedules credential/honeypot rotation |
| stale-marker-detector.ts | Detects when attackers interact with stale markers |
| deception-config.ts | Deception configuration |

#### Audit (8 files)

| Module | Purpose |
|--------|---------|
| audit-logger.ts | Immutable audit logging |
| audit-search.ts | Audit trail search |
| audit-retention.ts | Retention policy enforcement |
| audit-schemas.ts | Audit event schemas |
| policy-audit.ts | Policy compliance auditing |
| kill-switch-audit.ts | Kill switch action audit |

Compliance sub-modules:
- data-access-request.ts: GDPR data access requests.
- data-deletion.ts: GDPR right to erasure.
- gdpr-report.ts: GDPR compliance reporting.
- retention-policy.ts: Data retention configuration.

#### Governance (5 files)

| Module | Purpose |
|--------|---------|
| regulatory-classification.ts | EU AI Act classification |
| framework-scorer.ts | SOC2/ISO27001 scoring |
| build-governance-posture.ts | Governance posture generation |
| board-report-pdf.ts | Board-level PDF reports |
| industry-templates.ts | Industry-specific governance templates |

#### Trust / Blockchain (24 files)

| Module | Purpose |
|--------|---------|
| create-trust-sdk.ts | Trust SDK initialization |
| chain-config.ts | Blockchain configuration (Base Sepolia) |
| register-erc8004.ts | ERC-8004 agent identity registration (#6981) |
| attestation-adapter.ts | Attestation protocol adapter |
| attestation-namespace.ts | Attestation namespace management |
| attestation-metrics.ts | Attestation metrics |
| critical-event-attestation.ts | Critical event on-chain recording |
| run-weekly-attestation.ts | Weekly attestation cron |
| load-trust-attestations.ts | Load attestation history |
| load-trust-identity.ts | Load agent identity |
| trust-alerts.ts | Trust-based alerting |
| trust-history.ts | Trust score history |
| compute-trust-metrics.ts | Trust score computation |
| build-public-trust.ts | Public trust API |
| risk-spike-monitor.ts | Risk spike detection |
| incident-types.ts | Incident classification |
| compliance-report.ts | On-chain compliance report |

ERC-8126 sub-modules (security verification):
- compute-wav-score.ts: Weighted Assurance Verification score.
- compute-wv-score.ts: Weighted Verification score.
- run-weekly-verification.ts: Weekly verification cron.
- load-verifications.ts: Verification history.
- validation-registry.ts: Validation method registry.
- verification-types.ts: Verification type definitions.

#### Integration (11 files)

| Module | Purpose |
|--------|---------|
| adapter-registry.ts | Central adapter registry |
| agent-adapter.interface.ts | Standard adapter interface |
| scout-middleware.ts | Express middleware for Scout |
| scout-wrap.ts | Function wrapper for agent functions |
| scout-proxy.ts | HTTP reverse proxy with security |
| security-pipeline.ts | Security processing pipeline |

Adapters:
- carina-adapter.ts: Native Carina agent integration.
- openai-adapter.ts: OpenAI API integration.
- langchain-adapter.ts: LangChain framework integration.
- hermes-adapter.ts: Nous Research Hermes agent integration.
- openclaw-adapter.ts: OpenClaw agent integration.
- generic-adapter.ts: Generic agent adapter.

#### Alerts (11 files)

| Module | Purpose |
|--------|---------|
| dispatcher.ts | 6-channel alert dispatcher |
| throttle.ts | Alert rate limiting |
| escalation.ts | Escalation policy engine |
| routing.ts | Alert routing logic |
| types.ts | Alert type definitions |
| templates.ts | Alert message templates |

Channel implementations:
- discord.ts: Discord webhook alerts.
- email.ts: SMTP email alerts.
- slack.ts: Slack webhook alerts.
- sms.ts: Twilio/Vonage SMS alerts.
- telegram.ts: Telegram bot alerts.
- whatsapp.ts: WhatsApp Business API alerts.

Alert severity levels:
- **breach**: Active compromise, immediate kill switch.
- **critical**: High-confidence threat, requires immediate review.
- **warning**: Suspicious activity, elevated monitoring.
- **info**: Informational, no action required.

#### API (40+ endpoints)

| Endpoint Group | Key Files |
|----------------|-----------|
| account | account.ts (register, login, key management) |
| dashboard | dashboard.ts (dashboard data) |
| events | events.ts (event ingestion and query) |
| heartbeat | heartbeat.ts (instance heartbeat) |
| status | status.ts (instance status) |
| kill | kill.ts (kill switch trigger) |
| resume | resume.ts (resume suspended instance) |
| killswitch-status | killswitch-status.ts (kill switch state) |
| quarantine | quarantine.ts (tool quarantine) |
| block-session | block-session.ts (session blocking) |
| egress-control | egress-control.ts (egress filtering) |
| rate-control | rate-control.ts (rate limit configuration) |
| approvals | approvals.ts (approval management) |
| policy | policy.ts (policy management) |
| policy-evaluate | policy-evaluate.ts (policy evaluation) |
| policy-packs | policy-packs.ts (policy pack management) |
| auto-remediation | auto-remediation.ts (remediation config) |
| simulation | simulation.ts (attack simulation) |
| security-posture | security-posture.ts (posture reporting) |
| anomalies | anomalies.ts (anomaly data) |
| attack-surface | attack-surface.ts (attack surface analysis) |
| deception | deception.ts (deception configuration) |
| honeypots | honeypots.ts (honeypot management) |
| markers | markers.ts (stale marker data) |
| tripwires | tripwires.ts (tripwire data) |
| audit-search | audit-search.ts (audit trail query) |
| instances | instances.ts (instance management) |
| memory-control | memory-control.ts (memory management) |
| provision | provision.ts (tenant provisioning) |
| platform-settings | platform-settings.ts (platform config) |
| export | export.ts (JSON/CSV/PDF export) |
| industry-templates | industry-templates.ts (governance templates) |
| compliance | compliance.ts (compliance data) |
| governance | governance.ts (governance reports) |
| public-trust | public-trust.ts (public trust API: GET /api/public/trust) |
| trust-verify | trust-verify.ts (trust verification) |
| trust-enterprise | trust-enterprise.ts (enterprise trust) |
| incidents | incidents.ts (incident management) |
| alerts | alert-channels.ts (alert channel config) |
| response-terminal | response-terminal.ts (operator terminal) |
| readiness | readiness.ts (health check) |
| sse | sse.ts (server-sent events) |
| jit-privileges | jit-privileges.ts (JIT privilege management) |
| stats | stats.ts (aggregate statistics) |
| admin | admin.ts (admin functions) |

#### Middleware (5 files)

| File | Purpose |
|------|---------|
| auth.ts | General authentication |
| account-session.ts | Account session management (bcryptjs passwords) |
| operator-auth.ts | VERLOX operator authentication |
| plan-gate.ts | Subscription plan enforcement |
| provision-auth.ts | Provision endpoint authentication |

#### Deploy (2 files)

| File | Purpose |
|--------|---------|
| license-activator.ts | License key activation |
| deploy-command.ts | Deployment CLI commands |

#### Proxy (1 file)

| File | Purpose |
|--------|---------|
| openai-proxy.ts | OpenAI-compatible proxy with security filtering |

### 12.2 Scout Account System

- accounts / account_api_keys tables (auto-migrated on startup).
- Account registration, login, API key management.
- bcryptjs password hashing.
- Every event/status/heartbeat route requires requireApiKey middleware.
- Tenant keys (scout_live_*): Pro tenants get per-account keys provisioned from Stripe webhook.
- VERLOX internal provision via POST /api/internal/provision-tenant with X-Scout-Provision-Secret.

### 12.3 Scout Subscription Tiers

| Tier | Key | Features |
|------|-----|----------|
| scout_monitor | lsk_* | Basic event collection, dashboard, 1 instance, email alerts |
| scout_standard | lsk_* | + 5 instances, alert channels (Discord, Slack), basic audit |
| scout_pro | scout_live_* | + Unlimited instances, 6-channel alerting, policy packs, kill switch, deception, anomaly detection, trust dashboard, audit retention, 3 operators |
| enterprise | scout_live_* | + Custom policies, SSO, dedicated support, SLA, multi-tenant, governance reports (SOC2, ISO27001, EU AI Act), on-prem option |

### 12.4 Public Trust API

GET /api/public/trust: Public-facing trust score and verification status, consumed by carinaai.uk/trust marketing page. Displays on-chain ERC-8004 identity and ERC-8126 verification data.

---

## 13. Labyrinth Scout SDK (npm)

Published as @verlox/labyrinth-scout v0.2.0. 14 source files.

### 13.1 SDK Modules

| Module | Lines | Purpose |
|--------|-------|---------|
| client.ts | 260 | Event emission, heartbeat, registration, policy evaluation, approval polling, kill switch, context firewall, streaming, instance status |
| middleware.ts | - | Express middleware for intercepting HTTP requests |
| wrap.ts | - | Function wrapper for agent functions |
| kill-switch.ts | - | KillSwitchWatcher with SSE variant |

### 13.2 Adapters

| Adapter | Purpose |
|---------|---------|
| generic | Generic agent integration |
| openai | OpenAI API wrapper |
| anthropic | Anthropic Claude wrapper |
| carina | Native Carina integration |
| hermes | Hermes Agent wrapper |
| openclaw | OpenClaw agent wrapper |
| langchain | LangChain framework wrapper |

### 13.3 SDK Features

- Drop-in middleware for any Express/Node.js agent.
- Event batching and automatic retry.
- Heartbeat with configurable interval.
- Policy evaluation with local caching.
- Approval polling for human-in-the-loop.
- Kill switch watcher (Redis pub/sub or SSE).
- Context firewall for egress filtering.
- Instance status reporting.
- Streaming support for live agent monitoring.

---

## 14. Labyrinth Scout Marketing Site (labyrinthscout.com)

Static HTML/CSS/vanilla-JS site. No backend.

### 14.1 Sections

- Product overview and features.
- Pricing page (4 tiers).
- /trust: Public trust dashboard.
- /docs: Links to Scout documentation.
- Waitlist signup (localStorage fallback).
- Stripe checkout links for subscription tiers.

### 14.2 Deployment

- Plain rsync of static files to /www/wwwroot/labyrinthscout.com/.
- Nginx serves directly.
- Console hostname not publicly linked; emailed at provisioning.
- Extensionless URLs via nginx.clean-urls.conf and .htaccess.

---

## 15. Trust Layer (ERC-8004 / ERC-8126 / Blockchain)

The third layer of the three-layer architecture. Provides cryptographic proof of agent identity and security verification history.

### 15.1 ERC-8004: Agent Identity

- Agent identity token #6981 on Base Sepolia testnet.
- register-erc8004.ts: Handles registration.
- load-trust-identity.ts: Loads and verifies identity.
- Provides unique, verifiable on-chain identity for every Scout-verified Carina instance.

### 15.2 ERC-8126: Security Verification

Active verification on Base Sepolia.

| Module | Purpose |
|--------|---------|
| compute-wav-score.ts | Weighted Assurance Verification -- comprehensive security score |
| compute-wv-score.ts | Weighted Verification -- per-event verification score |
| run-weekly-verification.ts | Scheduled weekly verification batch |
| load-verifications.ts | Historical verification data |
| validation-registry.ts | Registered validation methods |
| verification-types.ts | Verification type taxonomy |

### 15.3 Trust Operations

- **Weekly Attestation** (run-weekly-attestation.ts): Automated on-chain attestation of security posture.
- **Critical Event Attestation** (critical-event-attestation.ts): Immediate on-chain recording of kill switch activations and breach events.
- **Trust Score** (compute-trust-metrics.ts): Composite score from historical compliance, incident frequency, and verification results.
- **Public Trust API** (build-public-trust.ts): Public-facing trust data for transparency.
- **Trust History** (trust-history.ts): Full chronological trust score audit trail.
- **Risk Spike Monitor** (risk-spike-monitor.ts): Real-time trust score anomaly detection.
- **Trust Alerts** (trust-alerts.ts): Alerting when trust score drops below threshold.
- **Compliance Report** (compliance-report.ts): On-chain compliance attestation.

### 15.4 Trust Setup Script

setup-trust.sh and trust-e2e-demo.sh: Automated trust layer deployment and end-to-end verification scripts.

---

## 16. LLM Provider Catalog

51 total provider definitions in provider-registry.ts. 40 are routable (active or experimental status) for chat. 6 are external-CLI. 1 is OAuth. 3 are catalog aliases. 1 is embeddings-only.

### 16.1 Active Providers (24)

| # | Provider | Default Model | Kind | Priority |
|---|----------|---------------|------|----------|
| 1 | DeepSeek | deepseek-chat | openai | 1 |
| 2 | Groq | llama-3.3-70b-versatile | openai | 2 |
| 3 | Gemini | gemini-2.0-flash | gemini (native) | 3 |
| 4 | Anthropic | claude-sonnet-4-6 | anthropic (native) | 4 |
| 5 | OpenAI | gpt-4o | openai | 5 |
| 6 | OpenRouter | anthropic/claude-sonnet-4 | openai | 6 |
| 7 | Together AI | meta-llama/Llama-3.3-70B-Instruct-Turbo | openai | 7 |
| 8 | Mistral | mistral-large-latest | openai | 8 |
| 9 | Cohere | command-r-plus-08-2024 | openai | 9 |
| 10 | Perplexity | sonar-pro | openai | 10 |
| 11 | Fireworks | llama-v3p3-70b-instruct | openai | 11 |
| 12 | xAI / Grok | grok-2-latest | openai | 12 |
| 13 | Moonshot (Kimi) | moonshot-v1-8k | openai | 13 |
| 14 | Qwen / DashScope | qwen-plus | openai | 14 |
| 15 | Zhipu GLM (Z.AI) | glm-4-flash | openai | 15 |
| 16 | Azure OpenAI | gpt-4o | openai | 16 |
| 17 | Cerebras | llama-3.3-70b | openai | 17 |
| 18 | DeepInfra | meta-llama/Llama-3.3-70B-Instruct | openai | 18 |
| 19 | Novita | deepseek/deepseek-r1 | openai | 19 |
| 20 | SiliconFlow | deepseek-ai/DeepSeek-V3 | openai | 20 |
| 21 | Ollama | llama3.2 | openai (local) | 21 |
| 22 | LM Studio | local-model | openai (local) | 22 |
| 23 | vLLM | default | openai (local) | 23 |
| 24 | NVIDIA NIM | nemotron-mini-4b-instruct | openai | 24 |

### 16.2 Experimental Providers (16)

| # | Provider | Default Model | Kind | Priority |
|---|----------|---------------|------|----------|
| 25 | Amazon Bedrock | anthropic.claude-3-5-sonnet | openai | 16 |
| 26 | Nous Research | default | openai | 25 |
| 27 | Hugging Face | meta-llama/Meta-Llama-3.1-8B-Instruct | openai | 26 |
| 28 | MiniMax | MiniMax-Text-01 | openai | 27 |
| 29 | MiniMax (CN) | MiniMax-Text-01 | openai | 28 |
| 30 | Xiaomi MiMo | MiMo-7B-RL | openai | 29 |
| 31 | llama.cpp | default | openai (local) | 30 |
| 32 | Custom Endpoint | default | openai | 31 |
| 33 | LiteLLM Proxy | gpt-4o-mini | openai (local) | 32 |
| 34 | SGLang | default | openai (local) | 33 |
| 35 | Google Vertex AI | gemini-2.0-flash | openai | 34 |
| 36 | Cloudflare AI Gateway | gpt-4o-mini | openai | 35 |
| 37 | BytePlus ModelArk | skylark-pro | openai | 36 |
| 38 | Tencent Hunyuan | hunyuan-lite | openai | 37 |
| 39 | Volcengine / Doubao | doubao-pro-32k | openai | 38 |
| 40 | Bedrock Mantle | amazon.titan-text-express-v1 | openai | 39 |

### 16.3 External CLI Providers (6)

| Provider | Requires |
|----------|----------|
| OpenAI Codex | npm i -g @openai/codex, OPENAI_API_KEY |
| GitHub Copilot | gh auth token, auto-upgrades via plugin |
| GitHub Copilot ACP | gh CLI, Copilot subscription, ACP-enabled IDE |
| Kilo Code | Install from kiloc.de, KILO_CODE_API_KEY |
| OpenCode Zen | Install from opencode.ai |
| OpenCode Go | Install from opencode.ai (same config as Zen) |

### 16.4 OAuth Provider (1)

| Provider | Note |
|----------|------|
| Qwen (OAuth) | OAuth flow via DashScope console. Use "qwen" provider for API key access. |

### 16.5 Aliases (3, catalog only, not routable)

| Alias | Routes To |
|-------|-----------|
| Kimi | moonshot |
| Z.AI / GLM | zhipu |
| Alibaba / DashScope | qwen |

### 16.6 Embeddings-Only (1)

| Provider | Default Model | Purpose |
|----------|---------------|---------|
| Voyage AI | voyage-3 | Embeddings for RAG and memory semantic search |

### 16.7 Provider Capabilities

Each provider declares capabilities:
- chat: Text conversation support.
- vision: Image input support.
- streaming: SSE token streaming.
- tools: Function/tool calling support.
- reasoning: Reasoning traces / chain-of-thought.
- reasoningEffort: Configurable reasoning effort.
- streamingTools: Tools with streaming output.
- embeddings: Vector embedding generation.

### 16.8 BYOK (Bring Your Own Key)

- AES-256-CBC encrypted tenant API keys stored in tenant_provider_keys table.
- Per-tenant provider configuration.
- Multi-key pools for high-throughput (apiKeysPoolEnv).
- Fallback chain with configurable priority.

---

## 17. Channel Adapter Catalog

### 17.1 Core Channel Adapters (44+)

Complete list of adapters in core.carinaai.uk/src/gateway/channels/adapters/:

| Adapter | Platform | Type |
|---------|----------|------|
| api-server-adapter.ts | REST API Server | API |
| dingtalk-adapter.ts | DingTalk | Enterprise chat |
| discord-adapter.ts | Discord | Community chat |
| email-channel-adapter.ts | Email | Messaging |
| feishu-chat-adapter.ts | Feishu (Lark) | Enterprise chat |
| google-chat-adapter.ts | Google Chat | Enterprise chat |
| gotify-adapter.ts | Gotify | Notifications |
| groupme-adapter.ts | GroupMe | Group chat |
| homeassistant-channel-adapter.ts | HomeAssistant | Smart home |
| imessage-adapter.ts | iMessage (Apple) | Messaging |
| instagram-adapter.ts | Instagram | Social media |
| irc-adapter.ts | IRC | Legacy chat |
| kakaotalk-adapter.ts | KakaoTalk | Messaging |
| keybase-adapter.ts | Keybase | Encrypted chat |
| line-adapter.ts | LINE | Messaging |
| linkedin-adapter.ts | LinkedIn | Professional social |
| matrix-adapter.ts | Matrix / Element | Federated chat |
| mattermost-adapter.ts | Mattermost | Enterprise chat |
| messenger-adapter.ts | Facebook Messenger | Social chat |
| nextcloud-talk-adapter.ts | Nextcloud Talk | Self-hosted chat |
| ntfy-adapter.ts | ntfy | Notifications |
| pushover-adapter.ts | Pushover | Notifications |
| rocketchat-adapter.ts | RocketChat | Enterprise chat |
| signal-adapter.ts | Signal | Encrypted messaging |
| slack-adapter.ts | Slack | Enterprise chat |
| sms-adapter.ts | SMS (Twilio/Vonage) | Messaging |
| teams-adapter.ts | Microsoft Teams | Enterprise chat |
| telegram-adapter.ts | Telegram | Messaging |
| threema-adapter.ts | Threema | Encrypted chat |
| twitch-adapter.ts | Twitch | Streaming |
| twitter-adapter.ts | Twitter/X | Social media |
| web-adapter.ts | Web (Browser) | Web |
| webex-adapter.ts | Webex | Enterprise chat |
| webhook-channel-adapter.ts | Generic Webhook | Integration |
| wechat-adapter.ts | WeChat | Messaging |
| whatsapp-adapter.ts | WhatsApp (Baileys) | Messaging |
| wire-adapter.ts | Wire | Encrypted chat |
| youtube-adapter.ts | YouTube | Video |
| zalo-adapter.ts | Zalo | Messaging |

Plus helper modules: irc-client.ts, meta-graph-base.ts, rest-channel-helpers.ts.

### 17.2 Public npm Channel Adapters (18)

The 18 adapters shipped in the public npm package: API Server, DingTalk, Discord, Email, Feishu Chat, HomeAssistant, iMessage, Matrix, Mattermost, REST helpers, Signal, Slack, SMS, Telegram, Web, Webhook, WeChat, WhatsApp.

### 17.3 Channel Features

- **Channel Registry** (channel-registry.ts): All adapters registered centrally.
- **Channel Routing** (channel-routing.ts): Routes messages to correct adapter.
- **Channel Capabilities** (channel-capabilities.ts): Declares what each channel supports.
- **Channel Status** (channel-status.ts): Health monitoring per channel.
- **Thread Ownership** (thread-ownership.ts): Conversation threading across channels.
- **Stub Channels** (stub-channels.ts): Test harness for channel development.
- **Catalog Channel Specs** (catalog-channel-specs.ts): Channel metadata.

---

## 18. Tool Catalog

53+ tools in core, organized by category:

### 18.1 System Tools
- **shell**: Execute shell commands with security controls.
- **process**: Process management and monitoring.
- **process-registry**: Process lifecycle tracking.
- **process-notifications**: Process state change notifications.
- **pty-runner**: PTY-based terminal execution.
- **file**: File system operations (read, write, list, delete).
- **patch**: Targeted file patching.
- **search-files**: File search (by name or content).
- **file-syntax**: Syntax detection and analysis.
- **path-utils**: Path manipulation utilities.

### 18.2 Communication Tools
- **http**: HTTP requests with response parsing.
- **email**: Email composition and management.
- **send-message**: Cross-channel message sending.
- **webhook**: Webhook callbacks.

### 18.3 AI and Coding Tools
- **code**: Code generation, analysis, and refactoring.
- **lsp**: Language Server Protocol for code intelligence.
- **mcp**: Model Context Protocol client for tool servers.
- **mixture-of-agents**: Multi-agent collaboration.
- **delegate-task**: Task delegation to sub-agents.
- **clarify**: Clarification request generation.
- **debug-helpers**: Debugging utilities.

### 18.4 Knowledge and Research Tools
- **web-search**: Web search with result processing.
- **memory**: Memory read/write with semantic search.
- **session-search**: Search across session history.
- **vision-analyze**: Vision/image analysis.
- **video-analyze**: Video content analysis.
- **transcription**: Audio transcription.
- **text-to-speech**: Text-to-speech generation.
- **image-generation**: AI image generation.
- **video-generation**: AI video generation.

### 18.5 Productivity Tools
- **todo**: Task management.
- **cronjob**: Scheduled task management.
- **kanban**: Kanban board management.
- **kanban-granular**: Fine-grained kanban operations.
- **contacts-tool**: Contact management.
- **checkpoint-manager**: Agent state checkpointing.
- **agent-sync-tool**: Cross-instance agent sync.

### 18.6 Integration Tools
- **integrations**: Discord, Feishu, HomeAssistant, X integration hub.
- **discord-admin**: Discord server administration.
- **homeassistant-granular**: Detailed HomeAssistant control.
- **feishu-granular**: Detailed Feishu operations.
- **yuanbao-granular**: Yuanbao AI operations.
- **spotify**: Spotify playback control.

### 18.7 Skill Tools
- **skills-tools**: Skill pack management.
- **skill-curator-tool**: Skill curation and organization.

### 18.8 Browser Tools
- **browser/tools.ts**: Web browsing capabilities.
- **browser/session.ts**: Browser session management.
- **browser/snapshot.ts**: Page snapshot capture.
- **browser/nav-guard.ts**: Navigation safety guard.

### 18.9 Security Tools
- **sandbox**: Sandboxed execution.
- **computer-use**: Controlled computer interaction.
- **domain-lookup**: Domain intelligence.
- **cache**: Response caching.

### 18.10 Tool Infrastructure
- **index.ts**: Tool exports.
- **registry.ts**: Central tool registration.
- **toolset.ts / toolset-config.ts**: Bundled tool collections with configurable sets.

---

## 19. Domain Pack Catalog

16 domain packs providing specialized agent knowledge:

| # | Pack Name | Domain |
|---|-----------|--------|
| 1 | property-uk | UK property law, conveyancing, tenancy, valuation, land registry, mortgage processes |
| 2 | legal-uk | UK legal research, case law, legislation, regulatory compliance |
| 3 | finance | Financial analysis, investment strategy, accounting, tax planning |
| 4 | data-science | Statistical analysis, ML workflows, data visualization, experiment design |
| 5 | core-engineering | Software engineering, system design, code review, architecture patterns |
| 6 | devops | CI/CD, infrastructure as code, cloud platforms, containerization |
| 7 | mlops | ML deployment, model monitoring, data pipelines, feature stores |
| 8 | media-extended | Audio/video processing, media production, editing workflows |
| 9 | creative-basics | Writing, design thinking, creative strategy, content creation |
| 10 | social-extended | Social media management, content strategy, engagement analytics |
| 11 | email-extended | Advanced email workflows, campaign management, deliverability |
| 12 | smart-home | Home automation, IoT, HomeAssistant, smart device control |
| 13 | healthcare | Medical knowledge, clinical workflows, health informatics |
| 14 | productivity | Task management, workflow automation, personal productivity |
| 15 | research-basics | Academic research, literature review, citation management |
| 16 | sales-crm | Sales workflows, CRM integration, pipeline management |

Each pack includes:
- Skill definitions with triggers and actions.
- Domain-specific prompt templates.
- Knowledge base entries.
- Tool configurations.
- Integration points.

Pack management CLI: `carina pack install <name>`, `carina pack list`, `carina pack remove <name>`, `carina pack create`.

---

## 20. Memory Backend Catalog

| # | Backend | Storage | Vector Search | Best For |
|---|---------|---------|---------------|----------|
| 1 | Builtin | In-process memory | None | Development, single-instance CLI use |
| 2 | SQLite | Local file | Via extension | Single-machine deployments, mobile |
| 3 | PostgreSQL + pgvector | Database server | Native pgvector | Production multi-tenant, high scale |
| 4 | Mem0 | Cloud API | Built-in | Managed memory service, rapid setup |
| 5 | Honcho | Self-hosted Docker | Built-in | Open-source agent memory platform |

Features across all backends:
- Episodic memory: Session-scoped short-term memory.
- Semantic memory: Cross-session long-term memory with embeddings.
- Session scroll: Automatic context window management.
- Session index: Searchable session history.
- REM: Automatic memory promotion from short-term to long-term.

---

## 21. Security Layer

### 21.1 Prompt Injection Protection

- injection-patterns.json: Curated database of known injection patterns (hundreds of patterns).
- prompt-guard.ts: Real-time injection detection before LLM calls.
- prompt-guard-middleware.ts: Pluggable middleware for any agent pipeline.
- Agent guard adapter: Integration with external security scanners.

### 21.2 Tool Access Control

- tool-policy.ts: Policy engine for tool authorization.
- tool-rbac.ts: Role-based access control for tools.
- tool-risk.ts: Risk scoring per tool invocation (input analysis, context assessment).
- tool-execution-context.ts: Tracks execution state for security decisions.
- tool-sequence-guard.ts: Detects dangerous sequences (e.g., shell -> http -> file exfil).
- tool-tiers.ts: Risk tiering (safe, moderate, high, restricted).
- approval-policy.ts: Human approval gating for high-risk actions.

### 21.3 Credential Management

- JIT Credentials (jit-credentials.ts): Just-in-time credentials scoped to single session. Never persisted. Auto-expire.
- BYOK Encryption: AES-256-CBC encrypted tenant API keys in database.
- Credential Vault (credentials/): Encrypted credential storage with rotation.
- sanitiseParams(): Redacts secrets before any data leaves the Carina process.

### 21.4 Kill Switch

Three ways to stop/restrict a Carina instance via Scout:

1. **suspend**: Halts entire agent (new actions throw with operator reason).
2. **block-session**: Blocks a specific session by ID.
3. **quarantine-tool**: Quarantines a specific tool on this instance (in-memory, lost on restart).

All actions logged to data/logs/labyrinth-suspend.log. Transport: Redis pub/sub on "labyrinth:control" channel.

### 21.5 Deception

| Technique | Module | Purpose |
|-----------|--------|---------|
| Honeypots | honeypot-manager.ts, honeypot-client.ts, honeypot-prompt-block.ts | Deploy decoy endpoints and prompts to detect attackers |
| Decoy Generation | decoy-generator.ts | Generate realistic-but-fake credentials, files, and prompts |
| Moving Target | moving-target.ts, rotation-scheduler.ts | Rotate honeypots and credentials on schedule |
| Stale Marker | stale-marker-detector.ts | Detect when an attacker touches a bait resource |
| Honeypot Claim Checker | honeypot-claim-checker.ts (Scout) | Verify if a claim involves honeypot data |

### 21.6 Egress Control

- egress-filter.ts: Controls what domains tools can access.
- Domain block lists (operator-configured via Scout API).
- In-memory blocks (lost on restart, re-pushed by Scout).

### 21.7 Anomaly Detection

- anomaly-detector.ts: ML-based detection of unusual agent behavior.
- anomaly-types.ts: Classification of anomaly types.
- Auto-remediation (auto-remediation.ts): Automatic responses to detected anomalies.

### 21.8 Scout Security Pipeline

The integration/security-pipeline.ts provides a layered approach:
1. Request interception (scout-middleware.ts, scout-wrap.ts, scout-proxy.ts).
2. Prompt injection check.
3. Tool policy evaluation.
4. Rate limit enforcement (token-bucket.ts).
5. Context firewall (context-firewall.ts).
6. Egress filter.
7. Event emission to Scout console.
8. Response sanitization.

---

## 22. Billing and Subscription Model

### 22.1 Carina Cloud Tiers

Carina Cloud at app.carinaai.uk:
- **Free tier**: Daily message quota, 1 workspace, basic tools.
- **Pro tier**: Higher quotas, BYOK, Scout integration, multiple workspaces, priority support.
- **Enterprise**: Custom quotas, dedicated infrastructure, SLA.

### 22.2 Labyrinth Scout Tiers

| Tier | Price Model | Features |
|------|------------|----------|
| scout_monitor | Monthly subscription | 1 instance, basic event collection, email alerts |
| scout_standard | Monthly subscription | 5 instances, Discord/Slack alerts, basic audit |
| scout_pro | Monthly subscription | Unlimited instances, 6-channel alerting, kill switch, deception, anomaly detection, policy packs, trust dashboard, 3 operators, audit retention |
| enterprise | Custom annual | All Pro + SSO, dedicated support, SLA, governance reports, on-prem option |

### 22.3 Stripe Integration

- Stripe Checkout for subscription signup.
- Stripe Customer Portal for self-service management.
- Stripe webhooks for event processing (checkout.session.completed, customer.subscription.updated, etc.).
- Usage-based metering for token consumption.
- Automatic Scout provisioning on Pro checkout (scout_live_* key generation).
- Invoice generation with PDF support.
- Reconciliation jobs for payment/usage matching.

### 22.4 Credit System

- credit-gate.ts: Pre-call credit check.
- credit-ledger.ts: Immutable transaction log.
- ops-metering-service.ts: Usage metering for billing.

---

## 23. Deployment and Infrastructure

### 23.1 Production Environment

Contabo VPS (80.190.81.208):

| Service | Port | Supervisor Name | Directory |
|---------|------|----------------|-----------|
| core.carinaai.uk | 3333 | carina-core | /home/malike/apps/core.carinaai.uk |
| console.labyrinthscout.com | 4444 | labyrinth-scout | /home/malike/apps/console.labyrinthscout.com |
| ops.carinaai.uk | 4002 | carina-ops | /home/malike/apps/ops.carinaai.uk |
| carinaai.uk | 80/443 | nginx (static) | /www/wwwroot/carinaai.uk |
| labyrinthscout.com | 80/443 | nginx (static) | /www/wwwroot/labyrinthscout.com |

### 23.2 Build and Deploy Process

1. Local `pnpm build` in the target package directory.
2. `rsync dist/` to Contabo VPS.
3. `npm install --production` on VPS.
4. `supervisorctl restart <service>`.

### 23.3 Deployment Scripts (17 files)

| Script | Purpose |
|--------|---------|
| deploy-carina.sh | Deploy core.carinaai.uk |
| deploy-scout.sh | Deploy console.labyrinthscout.com |
| deploy-marketing.sh | Deploy static marketing sites |
| publish-carina-agent.sh | Publish carina-agent to npm |
| bootstrap-carina-community.sh | Community setup bootstrap |
| export-carina-core-public.sh | Extract public package from core |
| verify-security-config.sh | Security configuration verification |
| post-deploy-security-check.sh | Post-deployment security audit |
| complete-production-security.sh | Full security hardening |
| setup-trust.sh | Trust layer setup |
| trust-e2e-demo.sh | End-to-end trust demo |
| rotate-scout-secrets.sh | Scout secret rotation |
| fix-writing-style.py | Writing style checker and fixer |

### 23.4 Infrastructure Modules

- PTY support (pty.ts): Pseudo-terminal for interactive sessions.
- WebSocket server (ws-server.ts): Real-time bi-directional communication.
- WebSocket transport (ws-transport.ts): Message framing and serialization.
- ACP bridge (acp-bridge/): Agent Communication Protocol bridging.
- Migrations (migrations/): Database schema versioning.
- Platform detection (host/): Linux, macOS, Windows detection.

### 23.5 Supervisor Configuration

Each service managed by supervisor:
- Auto-restart on failure.
- Log rotation.
- Environment variable injection.
- Process monitoring.

### 23.6 Nginx Configuration

- HTTPS via Let's Encrypt.
- Rate limiting.
- .htpasswd for Scout console Basic Auth.
- Clean URL rewrites for marketing sites.
- WebSocket upgrade support for gateway.
- Proxy pass to Node.js services.

---

## 24. Testing Coverage

| Package | Test Files | Framework | CI |
|---------|-----------|-----------|----|
| core.carinaai.uk | 406 | Vitest | GitHub Actions |
| console.labyrinthscout.com | 146 | Vitest | GitHub Actions |
| carinaMobile | 10+ | Vitest | GitHub Actions |
| ops.carinaai.uk | 10+ | Vitest | GitHub Actions |
| labyrinth-scout-sdk | 5 | Vitest | GitHub Actions |
| carina-agent-public | ~100 | Vitest | GitHub Actions |

Total test suite: 8148+ passing in CI (Scout console CI count).

Core test coverage thresholds: 60% lines, 60% functions (V8 coverage).

Test organization: *.test.ts files co-located with source files.

---

## 25. Competitive Positioning

### 25.1 Carina vs. AI Agent Frameworks

| Dimension | Carina | LangChain | CrewAI | AutoGPT | OpenAI Agents SDK |
|-----------|--------|-----------|--------|---------|-------------------|
| License | MIT (free) | MIT | MIT | MIT | Proprietary |
| Tools | 53+ battery-included | Framework, BYO | Few built-in | Few built-in | OpenAI-only |
| Memory backends | 5 pluggable | 3 pluggable | Limited | Rudimentary | None (stateless) |
| Channels | 30+ platforms | None built-in | None | None | None |
| Model routing | 51 providers, fallback chains | Limited | Single model | Single model | OpenAI only |
| Domain packs | 16 curated | None | None | None | None |
| Mobile app | Yes (Expo) | No | No | No | No |
| IDE extensions | VS Code, Cursor, Zed, JetBrains | No | No | No | No |
| Security layer | Scout (paid) | None | None | None | None |
| Trust/blockchain | ERC-8004/8126 | None | None | None | None |
| Self-improving | Auto-writer, curator, learner | No | No | No | No |
| npm install | carina-agent | langchain | crewai | None | openai-agents |
| CLI commands | 58 | ~10 | ~5 | ~10 | ~5 |

### 25.2 Labyrinth Scout vs. AI Security Tools

| Dimension | Scout | Guardrails AI | Nemo Guardrails | Lakera Guard | Prompt Shield |
|-----------|-------|---------------|-----------------|--------------|---------------|
| Prompt injection | Yes | Yes | Yes | Yes | Yes |
| Tool policy | Yes (RBAC, sequence, risk) | Limited | No | No | No |
| Kill switch | Yes (Redis, SSE) | No | No | No | No |
| Deception/honeypots | Yes | No | No | No | No |
| Anomaly detection | Yes (ML-based) | No | No | Yes | No |
| Blockchain trust | Yes (ERC-8004/8126) | No | No | No | No |
| Multi-agent | Yes (7 adapters) | No | No | No | No |
| 6-channel alerting | Yes | No | No | No | No |
| Audit trail | Yes (immutable) | Limited | Limited | Yes | No |
| EU AI Act ready | Yes | Partial | No | No | No |
| SOC2/ISO27001 reports | Yes | No | No | No | No |
| Self-hosted | Yes (Docker) | Partial | Yes | Cloud-only | Cloud-only |

### 25.3 Key Differentiators

1. **Complete platform**: Carina is not a library -- it is an agent kernel with tools, memory, channels, routing, packs, and security in one install.
2. **MIT license**: Free forever, no restrictions. Fork it, ship products on it, never pay for the kernel.
3. **Three-layer security model**: Agent (Carina) -> Security (Scout) -> Trust (Blockchain). No other agent platform has this.
4. **30+ channel adapters**: Carina works everywhere your users are -- Telegram, WhatsApp, Slack, Discord, SMS, web, API, and 20+ more.
5. **51 LLM providers**: No vendor lock-in. Route to any model, fallback automatically, bring your own keys.
6. **Self-improving**: Auto-writer, curator, and session-learner make the agent better over time without manual skill authoring.
7. **University program**: Free for education and research. Designed to be the standard agent platform for coursework.
8. **Built in Portsmouth, UK**: Independent, European-built, not beholden to Silicon Valley roadmap.

---

## 26. Roadmap and Current Status

### 26.1 Current Status (June 2026)

- **Carina Core**: v0.2.0, production-ready for single-instance and hosted multi-tenant.
- **Carina Agent (npm)**: v0.1.1, published and installable.
- **Carina Cloud**: Live at app.carinaai.uk with free tier and Stripe billing.
- **Carina Mobile**: Expo app with chat, tasks, trust dashboard.
- **Carina IDE Extensions**: VS Code/Cursor/Zed VSIX and JetBrains ZIP.
- **Labyrinth Scout**: v0.2.0, production-ready with accounts, 4 tiers, Stripe billing.
- **Scout SDK**: v0.2.0 on npm with 7 agent adapters.
- **Trust Layer**: ERC-8004 identity #6981 on Base Sepolia, ERC-8126 verifications active.
- **Infrastructure**: All services running on Contabo VPS, supervisor-managed, nginx-fronted.

### 26.2 Active Development

- Skill pack expansion and community contributions.
- Additional channel adapters and provider integrations.
- Scout policy pack library growth.
- Mobile app feature parity with web.
- Documentation expansion (docs.carinaai.uk).

### 26.3 Community

- GitHub: github.com/malike2356/carina-agent
- University program: Free for coursework and research.
- "Built on Carina" certification for ISVs.
- Community contributions via MIT license.

### 26.4 Documentation and Instructions

- 352 instruction .md files covering strategy, gap analysis, operations, 25 gap-closing prompts, 100+ action prompts (5 categories), and archive prompts by phase.
- 618+ brain markdown files (UK property knowledge).
- 41 archive files.

---

## 27. A-Z Glossary / Feature Index

### A

- **ACP** (Agent Communication Protocol): Protocol for IDE-agent communication, used by carina-ide extensions.
- **Agent Guard Adapter**: Security adapter for external guard systems.
- **Agent Identity** (ERC-8004): On-chain agent identity token #6981 on Base Sepolia.
- **Aliases**: Provider catalog aliases that route to other providers (Kimi -> moonshot, Z.AI -> zhipu, Alibaba -> qwen).
- **Anomaly Detection**: ML-based detection of unusual agent behavior in Scout.
- **API Key Encryption**: BYOK credentials encrypted with AES-256-CBC.
- **App Lock**: Mobile app biometric/pattern lock (useAppLock hook).
- **Approval Policy**: Human-in-the-loop approval for high-risk actions.
- **Attestation**: On-chain recording of security posture (weekly and critical event).
- **Audit Trail**: Immutable audit logging with retention policies, GDPR compliance.
- **Auto-Remediation**: Automated threat response in Scout.
- **Auto-Writer**: Self-improving skill generation from agent experiences.

### B

- **Base Sepolia**: Ethereum testnet for ERC-8004/ERC-8126 trust operations.
- **BCryptJS**: Password hashing for Scout accounts.
- **Bedrock**: Amazon Bedrock provider (experimental, OpenAI-compatible proxy).
- **Benchmark**: Agent benchmarking framework with competitor baselines.
- **Block Session**: Scout ability to block a specific Carina session.
- **Board Report PDF**: Governance PDF generation for board-level reporting.
- **Brain**: LLM abstraction layer (16 files) managing 51 providers.
- **Built on Carina**: Certification program for ISVs building products on Carina.
- **BYOK** (Bring Your Own Key): Tenant-managed, encrypted API keys for LLM providers.
- **BytePlus ModelArk**: BytePlus LLM provider (experimental).

### C

- **Customer brand**: Tenant or reseller product name, logo, and support identity shown to end users. See `internal/planning/strategy/BRAND_GLOSSARY.md` and `src/product/brand-glossary.ts`.
- **CalDAV**: Calendar integration via caldav-client.ts.
- **Carina Cloud**: Hosted SaaS at app.carinaai.uk with free tier.
- **Carina Core**: The agent kernel in core.carinaai.uk (760 source files).
- **Carina Hub**: Community skill pack discovery at hub.carinaai.uk.
- **Carina Mobile**: Expo Router React Native mobile app.
- **Channel Adapters**: 44+ in core, 18 in public npm. Connect Carina to 30+ platforms.
- **Check-In**: Periodic agent self-checks and status reporting.
- **Codex** (OpenAI): External CLI provider for coding assistance.
- **Commitments**: Agent commitment tracking for accountability.
- **Compliance Reports**: SOC2, ISO27001, EU AI Act readiness reports.
- **Context Firewall**: Per-session security firewall for context-level protection.
- **Playbook**: Hardware-aware model discovery and serve guidance (`carina playbook`, workspace `/playbook`). Situational paths, scoring, and domain plays when the full playbook engine is enabled.
- **Cookbook** (internal): Hardware/model catalog module at `src/cookbook/` consumed by Playbook. Not user-facing; deprecated as product language.
- **Cost Tracker**: Token usage and cost tracking per provider/session.
- **Credential Pool**: Multi-key rotation for high-throughput API usage.
- **Credential Vault**: Encrypted credential storage with rotation.
- **Cron**: Scheduled task system with workflow engine, parser, scheduler, and store.
- **CSS Tokens**: VERLOX brand design tokens (teal #0d9488).
- **Curator**: Automatic skill discovery and organization system.
- **Custom Endpoint**: Generic OpenAI-compatible endpoint provider.

### D

- **DashScope**: Alibaba/Qwen provider (routable) and OAuth variant.
- **Deception**: Honeypots, decoys, moving target rotation, stale marker detection.
- **Deep Research**: Extended research capability (deep-research.ts).
- **DeepSeek**: Default provider (priority 1), cost-efficient, reasoning capabilities.
- **Delegation Context**: Controls sub-agent access scope.
- **Device Pairing**: Secure device pairing for mobile/remote access.
- **DingTalk**: Enterprise chat channel adapter.
- **Discord**: Community chat channel adapter + admin tools + Scout alerts.
- **Docusaurus**: Documentation framework for docs.carinaai.uk.
- **Domain Packs**: 16 curated knowledge packs for specific domains.
- **Doubao**: Volcengine/Doubao provider (experimental).

### E

- **Egress Filter**: Controls what domains tools can access.
- **Embeddings**: Vector representations for semantic search (Voyage AI, others).
- **ERC-8004**: Ethereum standard for agent identity (#6981 on Base Sepolia).
- **ERC-8126**: Ethereum standard for security verification (WAV/WV scores).
- **Escalation**: Alert escalation policy engine with multi-tier routing.
- **EU AI Act**: Regulatory classification and compliance reporting.
- **Expo Router**: Mobile app framework (carinaMobile).
- **Express**: Web framework used by ops.carinaai.uk and Scout console.
- **Extensions**: Plugin system for third-party Carina add-ons.
- **External CLI**: Providers requiring external CLI tools (Codex, Copilot, Kilo Code, OpenCode).

### F

- **Fallback Chain**: Automatic provider fallback based on priority and health.
- **Feishu (Lark)**: Enterprise chat channel adapter with granular tools.
- **Fireworks**: LLM provider for open-source model inference.
- **First-Run Setup**: Onboarding wizard for new Carina installations.
- **Forensic Snapshot**: Security capture for incident investigation.
- **Framework Scorer**: SOC2/ISO27001 compliance scoring.

### G

- **Gateway**: Channel management system (98 files) with registry, routing, and 44+ adapters.
- **GDPR**: Compliance modules (data access, data deletion, GDPR reports, retention).
- **Gemini**: Google's LLM, native integration with vision support.
- **GitHub Copilot**: External CLI provider, auto-upgrades to API adapter via plugin.
- **Google Chat**: Enterprise chat channel adapter.
- **Gotify**: Notification channel adapter.
- **Grok** (xAI): xAI's Grok provider.
- **GroupMe**: Group chat channel adapter.

### H

- **Heartbeat**: Instance health reporting to Scout (POST /api/heartbeat).
- **HomeAssistant**: Smart home channel adapter with granular control tools.
- **Honcho**: Open-source agent memory backend.
- **Honeypot**: Decoy deployment for attacker detection.
- **Hosted**: Multi-tenant cloud platform (27 files) with org management, RBAC, quotas.
- **Hugging Face**: Experimental LLM provider via HF inference API.
- **Hunyuan**: Tencent Hunyuan provider (experimental).

### I

- **iMessage**: Apple iMessage channel adapter.
- **IMAP Fetcher**: Email retrieval via IMAP.
- **Industry Templates**: Governance/policy templates by industry vertical.
- **Injection Patterns**: Curated JSON database of hundreds of prompt injection patterns.
- **Instagram**: Social media channel adapter.
- **Instance ID**: Unique identifier for each Carina instance (carina-{hostname}).
- **IRC**: Legacy IRC chat adapter.
- **ISO27001**: Information security compliance framework.

### J

- **JIT Credentials**: Just-in-time credentials scoped to single session, never persisted.
- **JIT Privileges**: Just-in-time privilege escalation in Scout.

### K

- **KakaoTalk**: Korean messaging channel adapter.
- **Kanban**: Visual task management integrated into agent workflows.
- **Keybase**: Encrypted chat channel adapter.
- **Kill Switch**: Scout's ability to suspend, block, or quarantine Carina instances via Redis.
- **Kill Switch Listener**: Carina-side subscriber to Redis "labyrinth:control" channel.
- **Kimi**: Alias for Moonshot provider; also standalone alias entry.
- **Kilo Code**: External CLI coding agent provider.

### L

- **LINE**: Japanese/Asian messaging channel adapter.
- **LinkedIn**: Professional social media channel adapter.
- **LiteLLM Proxy**: Local LLM proxy provider.
- **llama.cpp**: Local LLM provider via llama.cpp server.
- **LM Studio**: Local LLM provider for desktop inference.
- **LSP** (Language Server Protocol): Code intelligence integration.

### M

- **Mattermost**: Enterprise chat channel adapter.
- **MCP** (Model Context Protocol): Client and server for tool server integration.
- **Mem0**: Cloud-hosted memory backend with semantic search.
- **Memory Backends**: 5 pluggable (builtin, SQLite, Postgres+pgvector, Mem0, Honcho).
- **Messenger** (Facebook): Social chat channel adapter.
- **MiMo** (Xiaomi): Xiaomi's MiMo LLM provider (experimental).
- **MiniMax**: Chinese LLM provider with international (minimax) and China (minimax-cn) variants.
- **Mistral**: European LLM provider, OpenAI-compatible.
- **Mixture of Agents**: Multi-agent collaboration tool.
- **Mobile**: Expo Router React Native app with chat, tasks, trust dashboard.
- **Model Routing**: Intelligent provider selection based on cost, speed, capabilities, health.
- **Moonshot (Kimi)**: Chinese LLM provider, OpenAI-compatible.
- **Moving Target**: Credential/honeypot rotation defense.

### N

- **Next.js 15**: App Router framework for app.carinaai.uk.
- **Nextcloud Talk**: Self-hosted chat channel adapter.
- **Notifications**: Scout push poller and push notification registration.
- **Nous Research**: Experimental provider via Nous Portal API.
- **Novita**: LLM inference provider.
- **ntfy**: Notification channel adapter.
- **NVIDIA NIM**: NVIDIA inference microservice provider.

### O

- **OAuth Providers**: Qwen OAuth flow (use standard qwen for API key access).
- **Ollama**: Local LLM provider for running models locally.
- **OpenAI Codex**: External CLI coding agent.
- **OpenClaw Adapter**: Scout adapter for OpenClaw agents.
- **OpenCode Zen/Go**: External CLI coding agents.
- **OpenRouter**: Multi-provider routing service.
- **Operator Session**: CARINA_OPERATOR_SESSION for cross-platform session unification.
- **Orchestrator**: Breaks complex tasks into sub-tasks and spawns sub-agents.

### P

- **Platform brand**: Canonical Carina naming on kernel, ops, CLI, and developer surfaces. Distinct from customer brand; see `internal/planning/strategy/BRAND_GLOSSARY.md`.
- **Pairing**: Connecting Carina instances to Scout accounts (5 env vars, 2 methods).
- **Perplexity**: Research-focused LLM provider.
- **Platform Knowledge**: Agent runtime knowledge in platform-knowledge.md.
- **Plugin System**: Extension/plugin registration with provider plugin support.
- **Policy Audit**: Compliance auditing of security policies.
- **Policy Gateway**: Policy enforcement gateway for Scout.
- **Policy Packs**: Bundled policy templates for Scout.
- **PostgreSQL + pgvector**: Production memory backend with vector search.
- **Profiles**: Dev isolation for multi-profile environments.
- **Prompt Cache**: Caching for reduced latency and cost.
- **Prompt Guard**: Injection detection with middleware, injection-patterns.json database.
- **Provider Capabilities**: Dynamic detection of LLM provider features.
- **Provider Health**: Health checks and availability monitoring.
- **Provider Registry**: Central definition of all 51 providers.
- **Provider Routing**: Intelligent routing with fallback chains.
- **Provider Tags**: Cost tier, speed, capability tagging.
- **PTY**: Pseudo-terminal support for interactive sessions (pty.ts, pty-runner.ts).
- **Public API**: Stable API for tool, memory, provider, channel, pack.
- **Public Trust API**: GET /api/public/trust for public trust dashboard.
- **Pushover**: Notification channel adapter.

### Q

- **Quarantine**: Scout's ability to quarantine a specific tool on a Carina instance.
- **Qwen (DashScope)**: Alibaba's LLM provider, OpenAI-compatible; also OAuth variant.

### R

- **RAG** (Retrieval-Augmented Generation): Embedding-based knowledge retrieval pipeline.
- **Rate Card**: Per-provider pricing configuration.
- **Reconciliation**: Payment/usage reconciliation job and scheduler.
- **Redis**: Pub/sub transport for Scout -> Carina kill switch communication.
- **Regulatory Classification**: EU AI Act classification system.
- **REM** (Relevant Episodic Memory): Automatic memory promotion from short-term to long-term.
- **Retention Policy**: Data retention configuration for audit/compliance.
- **Risk Registry**: Risk scoring and registration for tools and actions.
- **Risk Spike Monitor**: Real-time trust score anomaly detection.
- **Risk Transitions**: Risk state machine for tool authorization.
- **RocketChat**: Enterprise chat channel adapter.

### S

- **Sandbox**: Docker/worker/openshell sandbox for safe code execution.
- **Scout Client**: Carina-side client for batching and sending security events to Scout.
- **Scout Context**: Per-tenant scoping for hosted Scout deployments.
- **Scout Console**: The Scout web application at console.labyrinthscout.com.
- **Scout Middleware**: Express middleware for Scout integration.
- **Scout Proxy**: HTTP reverse proxy with security filtering.
- **Scout SDK**: @verlox/labyrinth-scout npm package for integrating Scout into any agent.
- **Scout Tiers**: 4 subscription tiers (monitor, standard, pro, enterprise).
- **Secrets Plan**: Ops module for managing deployment secrets.
- **Self-Improving**: Auto-writer, curator, and session-learner for continuous improvement.
- **Session Index**: Searchable session history with semantic and full-text search.
- **Session Learner**: Extracts reusable knowledge from agent conversations.
- **Session Scroll**: Automatic context window management for long conversations.
- **Session Shield**: Per-session security shield in Scout.
- **Setup Wizard**: First-run onboarding with provider selection and Scout pairing.
- **SGLang**: Local LLM provider via SGLang server.
- **Shield Report**: Security posture report generation.
- **Signal**: Encrypted messaging channel adapter.
- **SiliconFlow**: Chinese LLM inference provider.
- **Slack**: Enterprise chat channel adapter + Scout alerts.
- **SMS**: Messaging channel adapters (Twilio/Vonage) + Scout alerts.
- **SMTP Sender**: Outgoing email via SMTP.
- **SOC2**: Security compliance framework with scoring.
- **Spotify**: Music playback control integration.
- **SQLite**: Local memory backend for single-machine deployments.
- **Stale Marker**: Deception technique to detect attacker interactions.
- **Stripe**: Payment processing via Checkout, Portal, and webhooks.
- **Sub-Agents**: Specialized agents for coding, communication, research, file operations.
- **Subscription Manager**: Plan provisioning and lifecycle management.
- **Supervisor**: Process manager for production services (carina-core, labyrinth-scout, carina-ops).

### T

- **Task Classifier**: Routes tasks to appropriate models based on complexity.
- **Teams** (Microsoft): Enterprise chat channel adapter.
- **Telegram**: Messaging channel adapter + Scout alerts.
- **Tencent Hunyuan**: Chinese LLM provider (experimental).
- **Threema**: Encrypted chat channel adapter.
- **Together AI**: LLM provider for open-source models.
- **Token Bucket**: Rate limiting algorithm for tool calls and API access.
- **Tool Execution Context**: Tracks execution state for security decisions.
- **Tool Heatmap**: Scout dashboard widget showing tool usage intensity.
- **Tool Policy**: Policy-based tool access control with risk scoring.
- **Tool RBAC**: Role-based access control for tools.
- **Tool Risk**: Risk assessment per tool invocation.
- **Tool Runner**: Executes tool calls with security checks and rate limiting.
- **Tool Sequence Guard**: Detects dangerous sequences of tool calls.
- **Tool Tiers**: Risk tiering (safe, moderate, high, restricted).
- **Trajectory**: Records agent decision paths for debugging and learning.
- **Tripwire Registry**: Scout tripwire definitions for attack detection.
- **Trust Score**: Composite on-chain trust score from historical compliance and verification.
- **TUI** (Terminal UI): Terminal-based user interface.
- **Twitch**: Streaming platform channel adapter.

### V

- **Vertex AI**: Google Cloud Vertex AI provider (experimental).
- **VERLOX**: The company behind Carina and Labyrinth Scout.
- **Verification** (ERC-8126): On-chain security verification with WAV and WV scores.
- **vLLM**: Local LLM provider for high-throughput inference.
- **Volcengine/Doubao**: ByteDance LLM provider (experimental).
- **Voyage AI**: Embeddings-only provider for semantic search.

### W

- **WAV Score**: Weighted Assurance Verification score (ERC-8126).
- **Webex**: Enterprise chat channel adapter.
- **Webhook**: Generic webhook channel adapter + Stripe webhooks.
- **WeChat**: Chinese messaging channel adapter.
- **WhatsApp**: Messaging channel adapter (Baileys library, WhatsApp Business API) + Scout alerts.
- **Wire**: Encrypted chat channel adapter.
- **Workspace**: Multi-workspace support with isolation.
- **WV Score**: Weighted Verification score (ERC-8126).

### X

- **xAI / Grok**: Elon Musk's xAI provider, OpenAI-compatible.
- **X (Twitter)**: Social media channel adapter.

### Y

- **YouTube**: Video platform channel adapter.
- **Yuanbao**: Tencent's Yuanbao AI integration tools.

### Z

- **Z.AI / GLM**: Alias for Zhipu GLM provider.
- **Zalo**: Vietnamese messaging channel adapter.
- **Zhipu GLM**: Chinese LLM provider (Z.AI), OpenAI-compatible.

---

## Appendix A: File Count Summary

| Package | Source Files | Test Files | Lines (est.) |
|---------|-------------|-----------|--------------|
| core.carinaai.uk | 760 | 406 | ~150,000 |
| carina-agent-public | ~400 | ~100 | ~80,000 |
| console.labyrinthscout.com | 181 | 146 | ~40,000 |
| carinaMobile | 121 | 10+ | ~25,000 |
| ops.carinaai.uk | ~60 (routes+lib) | 10+ | ~15,000 |
| labyrinth-scout-sdk | 14 | 5 | ~3,000 |
| app.carinaai.uk | 47 | - | ~8,000 |
| extensions/ | ~15 | - | ~3,000 |
| shared/ | 3 CSS | - | ~500 |
| scripts/ | 17 | - | ~2,000 |
| instructions/ | 352 .md | - | ~40,000 |
| brain/ | 618 .md | - | ~50,000 |
| **TOTAL** | **~2,590** | **~680** | **~417,000** |

## Appendix B: Environment Variables Reference

### Core Carina
- CARINA_URL: Core API URL.
- CARINA_WEB_PASSWORD: Web UI password.
- CARINA_OPERATOR_HOSTS: Operator host list.
- CARINA_OPERATOR_SESSION: Cross-platform session ID.
- CARINA_LOCAL_LLM_ENABLED: Enable local LLM providers.
- CARINA_EMBEDDING_PROVIDER: Default embedding provider.

### Hosted
- HOSTED_MODE: Enable hosted SaaS.
- CARINA_HOSTED_APP_HOST: Hosted app hostname.
- CARINA_DB_URL: Central Postgres database URL.

### Scout
- LABYRINTH_ENABLED: Enable Scout integration.
- LABYRINTH_URL: Scout console URL.
- LABYRINTH_API_KEY: Scout API key (lscout_* or scout_live_*).
- LABYRINTH_INSTANCE_ID: Instance identifier.
- LABYRINTH_INSTANCE_NAME: Human-readable instance name.
- SCOUT_API_KEY: Scout API key (ops panel).
- SCOUT_URL: Scout console URL (ops panel).
- SCOUT_PROVISION_SECRET: Internal provision authentication.

### LLM Providers (partial list)
- OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, DEEPSEEK_API_KEY
- GROQ_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY, PERPLEXITY_API_KEY
- FIREWORKS_API_KEY, XAI_API_KEY, TOGETHER_API_KEY, OPENROUTER_API_KEY
- AZURE_OPENAI_API_KEY, AZURE_OPENAI_BASE_URL
- OLLAMA_ENABLED, OLLAMA_BASE_URL, LMSTUDIO_ENABLED, LMSTUDIO_BASE_URL
- VLLM_ENABLED, VLLM_BASE_URL, VOYAGE_API_KEY
- And many more (see provider-registry.ts for complete list).

## Appendix C: API Key Formats

| Prefix | Source | Purpose |
|--------|--------|---------|
| sk- | OpenAI, compatible | LLM API access |
| lsk_ | Scout internal | Scout Monitor/Standard API key |
| scout_live_ | Scout Provision | Scout Pro/Enterprise per-tenant API key |

## Appendix D: Production Port Map

| Port | Service | Protocol |
|------|---------|----------|
| 3333 | Carina Core API | HTTP |
| 4444 | Scout Console API | HTTP |
| 4002 | Ops Dashboard | HTTP |
| 80/443 | Nginx (static sites) | HTTP/HTTPS |
| 3000 | Carina Gateway (dev) | HTTP |
| 4000 | Ops Panel (dev) | HTTP |
| 11434 | Ollama (default) | HTTP |
| 1234 | LM Studio (default) | HTTP |
| 8000 | vLLM (default) | HTTP |
| 8080 | llama.cpp (default) | HTTP |
| 4000 | LiteLLM Proxy (default) | HTTP |
| 30000 | SGLang (default) | HTTP |

---

*Document maintained by VERLOX. Last updated: 15 June 2026. This is the single authoritative reference for the Carina + Labyrinth Scout platform. When in doubt, consult this document first.*
